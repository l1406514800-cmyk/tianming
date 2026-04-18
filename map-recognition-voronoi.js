// 反向 Voronoi 识别算法
// 从地图图片中提取种子点，重建 Voronoi 图

// ============================================================
// 反向 Voronoi 识别核心算法
// ============================================================

/**
 * 反向 Voronoi 识别：从地图提取种子点并重建
 * @param {HTMLImageElement} image - 地图图片
 * @param {Object} options - 识别选项
 * @returns {Promise<Object>} - Voronoi 地图数据
 */
async function recognizeMapVoronoi(image, options) {
    options = options || {};
    const borderThreshold = options.borderThreshold || 100;
    const minArea = options.minArea || 100;

    return new Promise((resolve, reject) => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imageData.data;

            console.log('\u5f00\u59cb\u53cd\u5411 Voronoi \u8bc6\u522b...', {
                width: canvas.width,
                height: canvas.height
            });

            // 步骤1: 检测边界线
            const borderMap = detectBorders(pixels, canvas.width, canvas.height, borderThreshold);
            console.log('\u8fb9\u754c\u7ebf\u68c0\u6d4b\u5b8c\u6210');

            // 步骤2: 识别封闭区域
            const regions = findEnclosedRegions(borderMap, canvas.width, canvas.height, minArea);
            console.log('\u8bc6\u522b\u5230', regions.length, '\u4e2a\u5c01\u95ed\u533a\u57df');

            // 步骤3: 提取种子点（每个区域的中心点）
            const seeds = [];
            regions.forEach((region, index) => {
                const center = calculateCenter(region.pixels);
                seeds.push({
                    x: center[0],
                    y: center[1],
                    id: 'region_' + (index + 1),
                    name: '\u5730\u5757' + (index + 1),
                    originalColor: extractRegionColor(pixels, region.pixels, canvas.width)
                });
            });
            console.log('\u63d0\u53d6\u5230', seeds.length, '\u4e2a\u79cd\u5b50\u70b9');

            // 步骤4: 使用 d3-delaunay 重建 Voronoi 图
            const voronoiData = rebuildVoronoi(seeds, canvas.width, canvas.height);
            console.log('Voronoi \u56fe\u91cd\u5efa\u5b8c\u6210');

            // 步骤5: 生成最终数据
            const mapData = {
                name: 'Voronoi \u8bc6\u522b\u5730\u56fe',
                width: canvas.width,
                height: canvas.height,
                backgroundImage: image,
                seeds: seeds,
                voronoi: voronoiData.voronoi,
                delaunay: voronoiData.delaunay,
                regions: voronoiData.regions
            };

            console.log('\u53cd\u5411 Voronoi \u8bc6\u522b\u5b8c\u6210\uff01');
            resolve(mapData);

        } catch (error) {
            console.error('\u8bc6\u522b\u5931\u8d25:', error);
            reject(error);
        }
    });
}

/**
 * 使用种子点重建 Voronoi 图
 */
function rebuildVoronoi(seeds, width, height) {
    // 准备种子点坐标
    const points = seeds.map(s => [s.x, s.y]);

    // 使用 d3-delaunay 生成 Voronoi 图
    const delaunay = Delaunay.from(points);
    const voronoi = delaunay.voronoi([0, 0, width, height]);

    // 生成区域数据
    const regions = [];

    for (let i = 0; i < seeds.length; i++) {
        const seed = seeds[i];
        const cell = voronoi.cellPolygon(i);

        if (!cell) continue;

        // 提取多边形坐标
        const coords = [];
        cell.forEach(point => {
            coords.push(point[0], point[1]);
        });

        // 计算邻居
        const neighbors = [];
        for (const neighbor of voronoi.neighbors(i)) {
            neighbors.push(seeds[neighbor].id);
        }

        regions.push({
            id: seed.id,
            name: seed.name,
            coords: coords,
            center: [seed.x, seed.y],
            neighbors: neighbors,
            terrain: 'plains',
            owner: '',
            color: seed.originalColor,
            resources: [],
            development: 50,
            troops: 0,
            characters: []
        });
    }

    return {
        voronoi: voronoi,
        delaunay: delaunay,
        regions: regions
    };
}

/**
 * 加载并识别地图（Voronoi 方法）
 */
async function loadAndRecognizeMapVoronoi(imageFile, options) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async function(e) {
            const img = new Image();

            img.onload = async function() {
                try {
                    showRecognitionProgress('\u6b63\u5728\u63d0\u53d6\u79cd\u5b50\u70b9...', 20);

                    // 使用 Voronoi 识别
                    const mapData = await recognizeMapVoronoi(img, options);

                    showRecognitionProgress('\u6b63\u5728\u91cd\u5efa Voronoi \u56fe...', 80);

                    hideRecognitionProgress();
                    resolve(mapData);

                } catch (error) {
                    hideRecognitionProgress();
                    reject(error);
                }
            };

            img.onerror = function() {
                hideRecognitionProgress();
                reject(new Error('\u56fe\u7247\u52a0\u8f7d\u5931\u8d25'));
            };

            img.src = e.target.result;
        };

        reader.onerror = function() {
            reject(new Error('\u6587\u4ef6\u8bfb\u53d6\u5931\u8d25'));
        };

        reader.readAsDataURL(imageFile);
    });
}

// ============================================================
// 增强的边界线检测（更精确）
// ============================================================

/**
 * 增强的边界线检测
 */
function detectBordersEnhanced(pixels, width, height, threshold) {
    const borderMap = new Uint8Array(width * height);

    // 第一遍：检测暗像素
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

            if (brightness < threshold) {
                borderMap[y * width + x] = 1;
            }
        }
    }

    // 第二遍：边缘增强（检测颜色突变）
    const edgeMap = new Uint8Array(width * height);
    const edgeThreshold = 30; // 颜色差异阈值

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];

            // 检查四个方向的颜色差异
            let maxDiff = 0;

            const directions = [
                [-1, 0], [1, 0], [0, -1], [0, 1]
            ];

            for (const [dx, dy] of directions) {
                const nx = x + dx;
                const ny = y + dy;
                const nidx = (ny * width + nx) * 4;

                const nr = pixels[nidx];
                const ng = pixels[nidx + 1];
                const nb = pixels[nidx + 2];

                const diff = Math.abs(r - nr) + Math.abs(g - ng) + Math.abs(b - nb);
                maxDiff = Math.max(maxDiff, diff);
            }

            if (maxDiff > edgeThreshold) {
                edgeMap[y * width + x] = 1;
            }
        }
    }

    // 合并两种检测结果
    for (let i = 0; i < borderMap.length; i++) {
        if (edgeMap[i] === 1) {
            borderMap[i] = 1;
        }
    }

    return borderMap;
}

/**
 * 细化边界线（骨架化）
 */
function thinBorders(borderMap, width, height) {
    const thinned = new Uint8Array(borderMap);
    let changed = true;
    let iterations = 0;
    const maxIterations = 10;

    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;

        const temp = new Uint8Array(thinned);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;

                if (thinned[idx] === 0) continue;

                // 计算邻居数量
                let neighbors = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        if (thinned[(y + dy) * width + (x + dx)] === 1) {
                            neighbors++;
                        }
                    }
                }

                // 如果邻居太少，可能是噪点，移除
                if (neighbors < 2) {
                    temp[idx] = 0;
                    changed = true;
                }
            }
        }

        for (let i = 0; i < thinned.length; i++) {
            thinned[i] = temp[i];
        }
    }

    return thinned;
}

// ============================================================
// 智能模式选择
// ============================================================

/**
 * 智能识别（自动选择最佳方法）
 */
async function smartRecognizeMapAdvanced(image, options) {
    // 分析图片特征
    const features = analyzeImageFeaturesAdvanced(image);

    console.log('\u56fe\u7247\u7279\u5f81\u5206\u6790:', features);

    if (features.hasVoronoiPattern) {
        console.log('\u68c0\u6d4b\u5230 Voronoi \u6a21\u5f0f\uff0c\u4f7f\u7528\u53cd\u5411 Voronoi \u8bc6\u522b');
        return recognizeMapVoronoi(image, options);
    } else if (features.hasBorders) {
        console.log('\u68c0\u6d4b\u5230\u8fb9\u754c\u7ebf\uff0c\u4f7f\u7528\u8fb9\u754c\u7ebf\u8bc6\u522b');
        return recognizeMapByBorders(image, options);
    } else {
        console.log('\u4f7f\u7528\u989c\u8272\u5206\u5272\u8bc6\u522b');
        return recognizeMapRegions(image, options);
    }
}

/**
 * 增强的图片特征分析
 */
function analyzeImageFeaturesAdvanced(image) {
    const canvas = document.createElement('canvas');
    const sampleSize = 200;
    canvas.width = sampleSize;
    canvas.height = sampleSize;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, sampleSize, sampleSize);

    const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
    const pixels = imageData.data;

    let darkPixels = 0;
    let edgePixels = 0;
    const totalPixels = sampleSize * sampleSize;

    // 统计暗像素
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

        if (brightness < 100) {
            darkPixels++;
        }
    }

    // 检测边缘
    for (let y = 1; y < sampleSize - 1; y++) {
        for (let x = 1; x < sampleSize - 1; x++) {
            const idx = (y * sampleSize + x) * 4;
            const r = pixels[idx];

            const rightIdx = (y * sampleSize + (x + 1)) * 4;
            const downIdx = ((y + 1) * sampleSize + x) * 4;

            const diffRight = Math.abs(r - pixels[rightIdx]);
            const diffDown = Math.abs(r - pixels[downIdx]);

            if (diffRight > 30 || diffDown > 30) {
                edgePixels++;
            }
        }
    }

    const darkRatio = darkPixels / totalPixels;
    const edgeRatio = edgePixels / totalPixels;

    return {
        hasBorders: darkRatio > 0.05 && darkRatio < 0.3,
        hasVoronoiPattern: edgeRatio > 0.1 && edgeRatio < 0.4 && darkRatio > 0.05,
        darkRatio: darkRatio,
        edgeRatio: edgeRatio
    };
}

// ============================================================
// 导出函数
// ============================================================

if (typeof window !== 'undefined') {
    window.recognizeMapVoronoi = recognizeMapVoronoi;
    window.loadAndRecognizeMapVoronoi = loadAndRecognizeMapVoronoi;
    window.smartRecognizeMapAdvanced = smartRecognizeMapAdvanced;
    window.detectBordersEnhanced = detectBordersEnhanced;
    window.thinBorders = thinBorders;
}
