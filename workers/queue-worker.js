const DEFAULT_MAX_ACTIVE = 10;
const DEFAULT_MAX_SVG_BYTES = 10 * 1024 * 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key, X-Delete-Token",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function text(data, status = 200, contentType = "text/plain; charset=utf-8") {
  return new Response(data, {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}

function randomId(bytes = 8) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, "0")).join("");
}

function isAdmin(request, env) {
  const token = env.ADMIN_TOKEN || "";
  if (!token) return false;
  const provided = request.headers.get("X-API-Key") || new URL(request.url).searchParams.get("api_key") || "";
  return provided === token;
}

function publicJob(job) {
  const { delete_token, ...safe } = job;
  return safe;
}

async function withFileSize(env, job) {
  if (!job || (job.file_size && job.file_size_bytes)) return job;
  const svg = await env.QUEUE_KV.get(`svg:${job.id}`);
  if (!svg) return job;
  const bytes = new TextEncoder().encode(svg).length;
  const updated = { ...job, file_size: bytes, file_size_bytes: bytes };
  await env.QUEUE_KV.put(`job:${job.id}`, JSON.stringify(updated));
  return updated;
}

async function getJobIndex(env) {
  const ids = await env.QUEUE_KV.get("jobs:index", "json");
  return Array.isArray(ids) ? ids : [];
}

async function putJobIndex(env, ids) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  await env.QUEUE_KV.put("jobs:index", JSON.stringify(unique));
}

async function listJobs(env, statusFilter = "") {
  const ids = await getJobIndex(env);
  const jobs = [];
  const liveIds = [];
  for (const id of ids) {
    let job = await env.QUEUE_KV.get(`job:${id}`, "json");
    if (!job) continue;
    liveIds.push(id);
    job = await withFileSize(env, job);
    if (statusFilter && job.status !== statusFilter) continue;
    jobs.push(job);
  }
  if (liveIds.length !== ids.length) await putJobIndex(env, liveIds);
  jobs.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  return jobs;
}

async function countActive(env) {
  const jobs = await listJobs(env);
  return jobs.filter(job => ["queued", "plotting"].includes(job.status || "queued")).length;
}

async function readRequestData(request) {
  const contentType = request.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    return await request.json();
  }
  if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    const data = {};
    for (const [key, value] of form.entries()) {
      data[key] = value instanceof File ? await value.text() : value;
    }
    return data;
  }
  return {};
}

async function handleCreate(request, env) {
  const maxActive = Number(env.MAX_ACTIVE || DEFAULT_MAX_ACTIVE);
  if (await countActive(env) >= maxActive) {
    return json({ error: `queue full; max active jobs is ${maxActive}` }, 409);
  }

  let data;
  try {
    data = await readRequestData(request);
  } catch {
    return json({ error: "invalid request body" }, 400);
  }

  const svg = String(data.svg || "");
  const maxBytes = Number(env.MAX_SVG_BYTES || DEFAULT_MAX_SVG_BYTES);
  const bytes = new TextEncoder().encode(svg).length;
  if (!svg || !/<svg[\s>]/i.test(svg)) return json({ error: "svg field required" }, 400);
  if (bytes > maxBytes) return json({ error: `svg too large; max ${maxBytes} bytes` }, 413);

  const jobId = randomId(4);
  const deleteToken = randomId(16);
  const job = {
    id: jobId,
    sketch_name: String(data.sketch_name || "Untitled").slice(0, 80),
    paper_size: String(data.paper_size || "8.5x11").slice(0, 32),
    orientation: String(data.orientation || "portrait").slice(0, 32),
    status: "queued",
    created_at: Math.floor(Date.now() / 1000),
    notes: String(data.notes || "").slice(0, 500),
    file_size: bytes,
    file_size_bytes: bytes,
    delete_token: deleteToken,
  };

  await env.QUEUE_KV.put(`job:${jobId}`, JSON.stringify(job));
  await env.QUEUE_KV.put(`svg:${jobId}`, svg);
  await putJobIndex(env, [jobId, ...await getJobIndex(env)]);

  return json({ ...publicJob(job), job_id: jobId, delete_token: deleteToken }, 201);
}

async function handleList(request, env) {
  const status = new URL(request.url).searchParams.get("status") || "";
  const jobs = await listJobs(env, status);
  return json(jobs.map(publicJob));
}

async function handleGetJob(jobId, env) {
  let job = await env.QUEUE_KV.get(`job:${jobId}`, "json");
  if (!job) return json({ error: "not found" }, 404);
  job = await withFileSize(env, job);
  return json(publicJob(job));
}

async function handleGetSvg(jobId, env) {
  const svg = await env.QUEUE_KV.get(`svg:${jobId}`);
  if (!svg) return json({ error: "not found" }, 404);
  return text(svg, 200, "image/svg+xml; charset=utf-8");
}

async function handleStatus(request, env, jobId) {
  if (!isAdmin(request, env)) return json({ error: "admin token required" }, 401);
  const job = await env.QUEUE_KV.get(`job:${jobId}`, "json");
  if (!job) return json({ error: "not found" }, 404);
  const data = await readRequestData(request);
  const status = String(data.status || "");
  if (!["queued", "plotting", "done", "error"].includes(status)) {
    return json({ error: "status must be queued, plotting, done, or error" }, 400);
  }
  job.status = status;
  await env.QUEUE_KV.put(`job:${jobId}`, JSON.stringify(job));
  return json(publicJob(job));
}

async function handleDelete(request, env, jobId) {
  const job = await env.QUEUE_KV.get(`job:${jobId}`, "json");
  if (!job) return json({ error: "not found" }, 404);

  const url = new URL(request.url);
  const deleteToken = request.headers.get("X-Delete-Token") || url.searchParams.get("delete_token") || "";
  if (!isAdmin(request, env) && deleteToken !== job.delete_token) {
    return json({ error: "delete token required" }, 401);
  }

  await env.QUEUE_KV.delete(`job:${jobId}`);
  await env.QUEUE_KV.delete(`svg:${jobId}`);
  await putJobIndex(env, (await getJobIndex(env)).filter(id => id !== jobId));
  return json({ deleted: jobId });
}

export default {
  async fetch(request, env) {
    try {
      if (request.method === "OPTIONS") return new Response("", { status: 204, headers: corsHeaders });
      if (!env.QUEUE_KV) return json({ error: "QUEUE_KV binding missing" }, 500);

      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "") || "/";

      if (path === "/" && request.method === "GET") {
        return json({ ok: true, service: "pl0tb0t queue" });
      }
      if (path === "/jobs" && request.method === "POST") return await handleCreate(request, env);
      if (path === "/jobs" && request.method === "GET") return await handleList(request, env);

      const m = path.match(/^\/jobs\/([^/]+)(?:\/(svg|status))?$/);
      if (!m) return json({ error: "not found" }, 404);

      const jobId = m[1];
      const action = m[2] || "";
      if (!action && request.method === "GET") return await handleGetJob(jobId, env);
      if (!action && request.method === "DELETE") return await handleDelete(request, env, jobId);
      if (action === "svg" && request.method === "GET") return await handleGetSvg(jobId, env);
      if (action === "status" && request.method === "PATCH") return await handleStatus(request, env, jobId);

      return json({ error: "method not allowed" }, 405);
    } catch (err) {
      return json({ error: err && err.message ? err.message : String(err) }, 500);
    }
  },
};
