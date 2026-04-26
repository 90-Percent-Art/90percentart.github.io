window.makeSketchUtils = window.makeSketchUtils || (function() {
    var DPI = 100;
    var PAPER_SIZES = {
        '5x7': { w: 5, h: 7 },
        '8.5x11': { w: 8.5, h: 11 },
        '11x14': { w: 11, h: 14 },
        '11x17': { w: 11, h: 17 },
        '14x17': { w: 14, h: 17 }
    };

    function buildPaperParams(defaultPaper, defaultMargin) {
        return [
            {
                id: 'paperSize',
                label: 'Paper size',
                type: 'select',
                value: defaultPaper || '8.5x11',
                options: [
                    { value: '5x7', label: '5 x 7"' },
                    { value: '8.5x11', label: '8.5 x 11"' },
                    { value: '11x14', label: '11 x 14"' },
                    { value: '11x17', label: '11 x 17"' },
                    { value: '14x17', label: '14 x 17"' }
                ]
            },
            {
                id: 'margin',
                label: 'Margin',
                type: 'select',
                value: String(defaultMargin || 1),
                options: [
                    { value: '0.5', label: '1/2 inch' },
                    { value: '1', label: '1 inch' }
                ]
            }
        ];
    }

    function getPaperPixels(paperSize) {
        var size = PAPER_SIZES[paperSize] || PAPER_SIZES['8.5x11'];
        return {
            width: Math.round(size.w * DPI),
            height: Math.round(size.h * DPI)
        };
    }

    function resizeCanvasToPaper(p, paperSize) {
        var dims = getPaperPixels(paperSize);
        if (p.width !== dims.width || p.height !== dims.height) {
            p.resizeCanvas(dims.width, dims.height);
        }
        return dims;
    }

    function createPaperCanvas(p, paperSize, renderer) {
        var dims = getPaperPixels(paperSize);
        if (typeof renderer !== 'undefined') {
            return p.createCanvas(dims.width, dims.height, renderer);
        }
        return p.createCanvas(dims.width, dims.height);
    }

    function getMarginPixels(marginInches) {
        return Number(marginInches) * DPI;
    }

    function mmToPixels(mm) {
        return (Number(mm) / 25.4) * DPI;
    }

    function drawPaperBorder(p) {
        p.push();
        p.noFill();
        p.stroke(180);
        p.strokeWeight(2);
        p.rect(1, 1, p.width - 2, p.height - 2);
        p.pop();
    }

    return {
        DPI: DPI,
        PAPER_SIZES: PAPER_SIZES,
        buildPaperParams: buildPaperParams,
        getPaperPixels: getPaperPixels,
        resizeCanvasToPaper: resizeCanvasToPaper,
        createPaperCanvas: createPaperCanvas,
        getMarginPixels: getMarginPixels,
        mmToPixels: mmToPixels,
        drawPaperBorder: drawPaperBorder
    };
})();
