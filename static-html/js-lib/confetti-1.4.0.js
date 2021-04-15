// canvas-confetti v1.4.0 built on 2021-03-10T12:32:33.488Z
!(function(window, module) {
// source content
  (function main(global, module, isWorker, workerSize) {
    const canUseWorker = !!(
      global.Worker &&
    global.Blob &&
    global.Promise &&
    global.OffscreenCanvas &&
    global.OffscreenCanvasRenderingContext2D &&
    global.HTMLCanvasElement &&
    global.HTMLCanvasElement.prototype.transferControlToOffscreen &&
    global.URL &&
    global.URL.createObjectURL);

    function noop() {}

    // create a promise if it exists, otherwise, just
    // call the function directly
    function promise(func) {
      const ModulePromise = module.exports.Promise;
      const Prom = ModulePromise !== void 0 ? ModulePromise : global.Promise;

      if (typeof Prom === 'function') {
        return new Prom(func);
      }

      func(noop, noop);

      return null;
    }

    const raf = (function() {
      const TIME = Math.floor(1000 / 60);
      let frame; let cancel;
      const frames = {};
      let lastFrameTime = 0;

      if (typeof requestAnimationFrame === 'function' && typeof cancelAnimationFrame === 'function') {
        frame = function(cb) {
          const id = Math.random();

          frames[id] = requestAnimationFrame(function onFrame(time) {
            if (lastFrameTime === time || lastFrameTime + TIME - 1 < time) {
              lastFrameTime = time;
              delete frames[id];

              cb();
            } else {
              frames[id] = requestAnimationFrame(onFrame);
            }
          });

          return id;
        };
        cancel = function(id) {
          if (frames[id]) {
            cancelAnimationFrame(frames[id]);
          }
        };
      } else {
        frame = function(cb) {
          return setTimeout(cb, TIME);
        };
        cancel = function(timer) {
          return clearTimeout(timer);
        };
      }

      return {frame: frame, cancel: cancel};
    }());

    const getWorker = (function() {
      let worker;
      let prom;
      const resolves = {};

      function decorate(worker) {
        function execute(options, callback) {
          worker.postMessage({options: options || {}, callback: callback});
        }
        worker.init = function initWorker(canvas) {
          const offscreen = canvas.transferControlToOffscreen();
          worker.postMessage({canvas: offscreen}, [offscreen]);
        };

        worker.fire = function fireWorker(options, size, done) {
          if (prom) {
            execute(options, null);
            return prom;
          }

          const id = Math.random().toString(36).slice(2);

          prom = promise(function(resolve) {
            function workerDone(msg) {
              if (msg.data.callback !== id) {
                return;
              }

              delete resolves[id];
              worker.removeEventListener('message', workerDone);

              prom = null;
              done();
              resolve();
            }

            worker.addEventListener('message', workerDone);
            execute(options, id);

            resolves[id] = workerDone.bind(null, {data: {callback: id}});
          });

          return prom;
        };

        worker.reset = function resetWorker() {
          worker.postMessage({reset: true});

          for (const id in resolves) {
            resolves[id]();
            delete resolves[id];
          }
        };
      }

      return function() {
        if (worker) {
          return worker;
        }

        if (!isWorker && canUseWorker) {
          const code = [
            'var CONFETTI, SIZE = {}, module = {};',
            '(' + main.toString() + ')(this, module, true, SIZE);',
            'onmessage = function(msg) {',
            '  if (msg.data.options) {',
            '    CONFETTI(msg.data.options).then(function () {',
            '      if (msg.data.callback) {',
            '        postMessage({ callback: msg.data.callback });',
            '      }',
            '    });',
            '  } else if (msg.data.reset) {',
            '    CONFETTI.reset();',
            '  } else if (msg.data.resize) {',
            '    SIZE.width = msg.data.resize.width;',
            '    SIZE.height = msg.data.resize.height;',
            '  } else if (msg.data.canvas) {',
            '    SIZE.width = msg.data.canvas.width;',
            '    SIZE.height = msg.data.canvas.height;',
            '    CONFETTI = module.exports.create(msg.data.canvas);',
            '  }',
            '}',
          ].join('\n');
          try {
            worker = new Worker(URL.createObjectURL(new Blob([code])));
          } catch (e) {
          // eslint-disable-next-line no-console
          typeof console !== undefined && typeof console.warn === 'function' ? console.warn('🎊 Could not load worker', e) : null;

          return null;
          }

          decorate(worker);
        }

        return worker;
      };
    })();

    const defaults = {
      particleCount: 50,
      angle: 90,
      spread: 45,
      startVelocity: 45,
      decay: 0.9,
      gravity: 1,
      drift: 0,
      ticks: 200,
      x: 0.5,
      y: 0.5,
      shapes: ['square', 'circle'],
      zIndex: 100,
      colors: [
        '#26ccff',
        '#a25afd',
        '#ff5e7e',
        '#88ff5a',
        '#fcff42',
        '#ffa62d',
        '#ff36ff',
      ],
      // probably should be true, but back-compat
      disableForReducedMotion: false,
      scalar: 1,
    };

    function convert(val, transform) {
      return transform ? transform(val) : val;
    }

    function isOk(val) {
      return !(val === null || val === undefined);
    }

    function prop(options, name, transform) {
      return convert(
      options && isOk(options[name]) ? options[name] : defaults[name],
      transform,
      );
    }

    function onlyPositiveInt(number) {
      return number < 0 ? 0 : Math.floor(number);
    }

    function randomInt(min, max) {
    // [min, max)
      return Math.floor(Math.random() * (max - min)) + min;
    }

    function toDecimal(str) {
      return parseInt(str, 16);
    }

    function colorsToRgb(colors) {
      return colors.map(hexToRgb);
    }

    function hexToRgb(str) {
      let val = String(str).replace(/[^0-9a-f]/gi, '');

      if (val.length < 6) {
        val = val[0]+val[0]+val[1]+val[1]+val[2]+val[2];
      }

      return {
        r: toDecimal(val.substring(0, 2)),
        g: toDecimal(val.substring(2, 4)),
        b: toDecimal(val.substring(4, 6)),
      };
    }

    function getOrigin(options) {
      const origin = prop(options, 'origin', Object);
      origin.x = prop(origin, 'x', Number);
      origin.y = prop(origin, 'y', Number);

      return origin;
    }

    function setCanvasWindowSize(canvas) {
      canvas.width = document.documentElement.clientWidth;
      canvas.height = document.documentElement.clientHeight;
    }

    function setCanvasRectSize(canvas) {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    function getCanvas(zIndex) {
      const canvas = document.createElement('canvas');

      canvas.style.position = 'fixed';
      canvas.style.top = '0px';
      canvas.style.left = '0px';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = zIndex;

      return canvas;
    }

    function ellipse(context, x, y, radiusX, radiusY, rotation, startAngle, endAngle, antiClockwise) {
      context.save();
      context.translate(x, y);
      context.rotate(rotation);
      context.scale(radiusX, radiusY);
      context.arc(0, 0, 1, startAngle, endAngle, antiClockwise);
      context.restore();
    }

    function randomPhysics(opts) {
      const radAngle = opts.angle * (Math.PI / 180);
      const radSpread = opts.spread * (Math.PI / 180);

      return {
        x: opts.x,
        y: opts.y,
        wobble: Math.random() * 10,
        velocity: (opts.startVelocity * 0.5) + (Math.random() * opts.startVelocity),
        angle2D: -radAngle + ((0.5 * radSpread) - (Math.random() * radSpread)),
        tiltAngle: Math.random() * Math.PI,
        color: opts.color,
        shape: opts.shape,
        tick: 0,
        totalTicks: opts.ticks,
        decay: opts.decay,
        drift: opts.drift,
        random: Math.random() + 5,
        tiltSin: 0,
        tiltCos: 0,
        wobbleX: 0,
        wobbleY: 0,
        gravity: opts.gravity * 3,
        ovalScalar: 0.6,
        scalar: opts.scalar,
      };
    }

    function updateFetti(context, fetti) {
      fetti.x += Math.cos(fetti.angle2D) * fetti.velocity + fetti.drift;
      fetti.y += Math.sin(fetti.angle2D) * fetti.velocity + fetti.gravity;
      fetti.wobble += 0.1;
      fetti.velocity *= fetti.decay;
      fetti.tiltAngle += 0.1;
      fetti.tiltSin = Math.sin(fetti.tiltAngle);
      fetti.tiltCos = Math.cos(fetti.tiltAngle);
      fetti.random = Math.random() + 5;
      fetti.wobbleX = fetti.x + ((10 * fetti.scalar) * Math.cos(fetti.wobble));
      fetti.wobbleY = fetti.y + ((10 * fetti.scalar) * Math.sin(fetti.wobble));

      const progress = (fetti.tick++) / fetti.totalTicks;

      const x1 = fetti.x + (fetti.random * fetti.tiltCos);
      const y1 = fetti.y + (fetti.random * fetti.tiltSin);
      const x2 = fetti.wobbleX + (fetti.random * fetti.tiltCos);
      const y2 = fetti.wobbleY + (fetti.random * fetti.tiltSin);

      context.fillStyle = 'rgba(' + fetti.color.r + ', ' + fetti.color.g + ', ' + fetti.color.b + ', ' + (1 - progress) + ')';
      context.beginPath();

      if (fetti.shape === 'circle') {
      context.ellipse ?
        context.ellipse(fetti.x, fetti.y, Math.abs(x2 - x1) * fetti.ovalScalar, Math.abs(y2 - y1) * fetti.ovalScalar, Math.PI / 10 * fetti.wobble, 0, 2 * Math.PI) :
        ellipse(context, fetti.x, fetti.y, Math.abs(x2 - x1) * fetti.ovalScalar, Math.abs(y2 - y1) * fetti.ovalScalar, Math.PI / 10 * fetti.wobble, 0, 2 * Math.PI);
      } else if (fetti.shape.substring(0, 6) === 'emoji:') {
        context.fillText(fetti.shape.substring(6), x1, y1);
      } else {
        context.moveTo(Math.floor(fetti.x), Math.floor(fetti.y));
        context.lineTo(Math.floor(fetti.wobbleX), Math.floor(y1));
        context.lineTo(Math.floor(x2), Math.floor(y2));
        context.lineTo(Math.floor(x1), Math.floor(fetti.wobbleY));
      }

      context.closePath();
      context.fill();

      return fetti.tick < fetti.totalTicks;
    }

    function animate(canvas, fettis, resizer, size, done) {
      let animatingFettis = fettis.slice();
      const context = canvas.getContext('2d');
      let animationFrame;
      let destroy;

      context.font = '3em Arial';

      const prom = promise(function(resolve) {
        function onDone() {
          animationFrame = destroy = null;

          context.clearRect(0, 0, size.width, size.height);

          done();
          resolve();
        }

        function update() {
          if (isWorker && !(size.width === workerSize.width && size.height === workerSize.height)) {
            size.width = canvas.width = workerSize.width;
            size.height = canvas.height = workerSize.height;
          }

          if (!size.width && !size.height) {
            resizer(canvas);
            size.width = canvas.width;
            size.height = canvas.height;
          }

          context.clearRect(0, 0, size.width, size.height);

          animatingFettis = animatingFettis.filter(function(fetti) {
            return updateFetti(context, fetti);
          });

          if (animatingFettis.length) {
            animationFrame = raf.frame(update);
          } else {
            onDone();
          }
        }

        animationFrame = raf.frame(update);
        destroy = onDone;
      });

      return {
        addFettis: function(fettis) {
          animatingFettis = animatingFettis.concat(fettis);

          return prom;
        },
        canvas: canvas,
        promise: prom,
        reset: function() {
          if (animationFrame) {
            raf.cancel(animationFrame);
          }

          if (destroy) {
            destroy();
          }
        },
      };
    }

    function confettiCannon(canvas, globalOpts) {
      const isLibCanvas = !canvas;
      const allowResize = !!prop(globalOpts || {}, 'resize');
      const globalDisableForReducedMotion = prop(globalOpts, 'disableForReducedMotion', Boolean);
      const shouldUseWorker = canUseWorker && !!prop(globalOpts || {}, 'useWorker');
      const worker = shouldUseWorker ? getWorker() : null;
      const resizer = isLibCanvas ? setCanvasWindowSize : setCanvasRectSize;
      let initialized = (canvas && worker) ? !!canvas.__confetti_initialized : false;
      const preferLessMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion)').matches;
      let animationObj;

      function fireLocal(options, size, done) {
        const particleCount = prop(options, 'particleCount', onlyPositiveInt);
        const angle = prop(options, 'angle', Number);
        const spread = prop(options, 'spread', Number);
        const startVelocity = prop(options, 'startVelocity', Number);
        const decay = prop(options, 'decay', Number);
        const gravity = prop(options, 'gravity', Number);
        const drift = prop(options, 'drift', Number);
        const colors = prop(options, 'colors', colorsToRgb);
        const ticks = prop(options, 'ticks', Number);
        const shapes = prop(options, 'shapes');
        const scalar = prop(options, 'scalar');
        const origin = getOrigin(options);

        let temp = particleCount;
        const fettis = [];

        const startX = canvas.width * origin.x;
        const startY = canvas.height * origin.y;

        while (temp--) {
          fettis.push(
              randomPhysics({
                x: startX,
                y: startY,
                angle: angle,
                spread: spread,
                startVelocity: startVelocity,
                color: colors[temp % colors.length],
                shape: shapes[randomInt(0, shapes.length)],
                ticks: ticks,
                decay: decay,
                gravity: gravity,
                drift: drift,
                scalar: scalar,
              }),
          );
        }

        // if we have a previous canvas already animating,
        // add to it
        if (animationObj) {
          return animationObj.addFettis(fettis);
        }

        animationObj = animate(canvas, fettis, resizer, size, done);

        return animationObj.promise;
      }

      function fire(options) {
        const disableForReducedMotion = globalDisableForReducedMotion || prop(options, 'disableForReducedMotion', Boolean);
        const zIndex = prop(options, 'zIndex', Number);

        if (disableForReducedMotion && preferLessMotion) {
          return promise(function(resolve) {
            resolve();
          });
        }

        if (isLibCanvas && animationObj) {
        // use existing canvas from in-progress animation
          canvas = animationObj.canvas;
        } else if (isLibCanvas && !canvas) {
        // create and initialize a new canvas
          canvas = getCanvas(zIndex);
          document.body.appendChild(canvas);
        }

        if (allowResize && !initialized) {
        // initialize the size of a user-supplied canvas
          resizer(canvas);
        }

        const size = {
          width: canvas.width,
          height: canvas.height,
        };

        if (worker && !initialized) {
          worker.init(canvas);
        }

        initialized = true;

        if (worker) {
          canvas.__confetti_initialized = true;
        }

        function onResize() {
          if (worker) {
          // TODO this really shouldn't be immediate, because it is expensive
            const obj = {
              getBoundingClientRect: function() {
                if (!isLibCanvas) {
                  return canvas.getBoundingClientRect();
                }
              },
            };

            resizer(obj);

            worker.postMessage({
              resize: {
                width: obj.width,
                height: obj.height,
              },
            });
            return;
          }

          // don't actually query the size here, since this
          // can execute frequently and rapidly
          size.width = size.height = null;
        }

        function done() {
          animationObj = null;

          if (allowResize) {
            global.removeEventListener('resize', onResize);
          }

          if (isLibCanvas && canvas) {
            document.body.removeChild(canvas);
            canvas = null;
            initialized = false;
          }
        }

        if (allowResize) {
          global.addEventListener('resize', onResize, false);
        }

        if (worker) {
          return worker.fire(options, size, done);
        }

        return fireLocal(options, size, done);
      }

      fire.reset = function() {
        if (worker) {
          worker.reset();
        }

        if (animationObj) {
          animationObj.reset();
        }
      };

      return fire;
    }

    module.exports = confettiCannon(null, {useWorker: true, resize: true});
    module.exports.create = confettiCannon;
  }((function() {
    if (typeof window !== 'undefined') {
      return window;
    }

    if (typeof self !== 'undefined') {
      return self;
    }

    return this || {};
  })(), module, false));

  // end source content

  window.confetti = module.exports;
}(window, {}));
