import path from 'path';

import loaderUtils from 'loader-utils';
import validateOptions from 'schema-utils';

import schema from './options.json';

const loaderApi = () => {};

// request 是当前处理的 css 的绝对路径
// /Users/qinghewang/code/webpack-demo/node_modules/css-loader/dist/cjs.js!/Users/qinghewang/code/webpack-demo/src/style.css
// stringifyRequest
// ../node_modules/css-loader/dist/cjs.js!./style.css

loaderApi.pitch = function loader(request) {
  console.log('hello style loader src', request)
  console.log('stringifyRequesst', loaderUtils.stringifyRequest(this, request))
  // options 来自 this.query
  const options = loaderUtils.getOptions(this) || {};

  validateOptions(schema, options, {
    name: 'Style Loader',
    baseDataPath: 'options',
  });

  const insert =
    typeof options.insert === 'undefined'
      ? '"head"'
      : typeof options.insert === 'string'
      ? JSON.stringify(options.insert)
      : options.insert.toString();
  const injectType = options.injectType || 'styleTag';
  const esModule =
    typeof options.esModule !== 'undefined' ? options.esModule : false;

  delete options.esModule;

  console.log('this hot', this.hot)

  switch (injectType) {
    case 'linkTag': {
      let hmrCode = ''
      if (this.hot) {
        hmrCode = 
        `if (module.hot) {
          module.hot.accept(
            ${loaderUtils.stringifyRequest(this, `!!${request}`)},
            function() {
            ${
              esModule
                ? `update(content);`
                : `var newContent = require(${loaderUtils.stringifyRequest(
                    this,
                    `!!${request}`
                  )});

                  newContent = newContent.__esModule ? newContent.default : newContent;

                  update(newContent);`
            }
            }
          );

          module.hot.dispose(function() {
            update();
          });
        }`
      }

      const commonModleCode = 
        `var api = require(${loaderUtils.stringifyRequest(
          this,
          `!${path.join(__dirname, 'runtime/injectStylesIntoLinkTag.js')}`
        )});
        var content = require(${loaderUtils.stringifyRequest(
          this,
          `!!${request}`
        )});

        content = content.__esModule ? content.default : content;`
      
      const esModuleCode = 
        `import api from ${loaderUtils.stringifyRequest(
          this,
          `!${path.join(__dirname, 'runtime/injectStylesIntoLinkTag.js')}`
        )};
        import content from ${loaderUtils.stringifyRequest(
          this,
          `!!${request}`
        )};`

      return `
        ${esModule ? commonModleCode : esModuleCode}

        var options = ${JSON.stringify(options)};

        options.insert = ${insert};

        var update = api(content, options);

        ${hmrCode}

        ${esModule ? `export default {}` : ''}`;
    }

    case 'lazyStyleTag':
    case 'lazySingletonStyleTag': {
      const isSingleton = injectType === 'lazySingletonStyleTag';

      let hmrCode = ''
      if (this.hot) {
        hmrCode = 
        `if (module.hot) {
          var lastRefs = module.hot.data && module.hot.data.refs || 0;
        
          if (lastRefs) {
            exported.use();
        
            if (!content.locals) {
              refs = lastRefs;
            }
          }
        
          if (!content.locals) {
            module.hot.accept();
          }
        
          module.hot.dispose(function(data) {
            data.refs = content.locals ? 0 : refs;
        
            if (dispose) {
              dispose();
            }
          });
        }`
      }

      const commonModuleCode = 
        `var api = require(${loaderUtils.stringifyRequest(
          this,
          `!${path.join(__dirname, 'runtime/injectStylesIntoStyleTag.js')}`
        )});
        var content = require(${loaderUtils.stringifyRequest(
          this,
          `!!${request}`
        )});

        content = content.__esModule ? content.default : content;

        if (typeof content === 'string') {
          content = [[module.id, content, '']];
        }`

        const esModuleCode = 
          `import api from ${loaderUtils.stringifyRequest(
            this,
            `!${path.join(__dirname, 'runtime/injectStylesIntoStyleTag.js')}`
          )};
          import content from ${loaderUtils.stringifyRequest(
            this,
            `!!${request}`
          )};`

      return `
        ${ esModule ? esModuleCode : commonModuleCode }

        var refs = 0;
        var dispose;
        var options = ${JSON.stringify(options)};

        options.insert = ${insert};
        options.singleton = ${isSingleton};

        var exported = {};

        if (content.locals) {
          exported.locals = content.locals;
        }

        exported.use = function() {
          if (!(refs++)) {
            dispose = api(content, options);
          }

          return exported;
        };

        exported.unuse = function() {
          if (refs > 0 && !--refs) {
            dispose();
            dispose = null;
          }
        };

        ${hmrCode}

        ${esModule ? 'export default' : 'module.exports ='} exported;`;
    }

    case 'styleTag':
    case 'singletonStyleTag':
    default: {
      const isSingleton = injectType === 'singletonStyleTag';
      console.log('esModule', esModule)
      let hmrCode = ''
      if (this.hot) {
        hmrCode = `
        if (module.hot) {
          console.log('hmr code 1')
          if (!content.locals) {
            console.log('hmr code 2')
            module.hot.accept(
              ${loaderUtils.stringifyRequest(this, `!!${request}`)},
              function () {
                console.log('hmr code 2.1')
                ${
                  esModule
                    ? `update(content);`
                    : `var newContent = require(${loaderUtils.stringifyRequest(
                        this,
                        `!!${request}`
                      )});
        
                      newContent = newContent.__esModule ? newContent.default : newContent;
        
                      if (typeof newContent === 'string') {
                        newContent = [[module.id, newContent, '']];
                      }
        
                      update(newContent);`
                }
              }
            )
          }

          console.log('hmr code 3')
        
          module.hot.dispose(function() { 
            console.log('hmr code 4')
            update();
          });
        }`
      }

      const commonModuleCode = 
        `var api = require(${loaderUtils.stringifyRequest(
          this,
          `!${path.join(__dirname, 'runtime/injectStylesIntoStyleTag.js')}`
        )});
        var content = require(${loaderUtils.stringifyRequest(
          this,
          `!!${request}`
        )});

        content = content.__esModule ? content.default : content;

        if (typeof content === 'string') {
          content = [[module.id, content, '']];
        }`

      const esModleCode = 
        `import api from ${loaderUtils.stringifyRequest(
          this,
          `!${path.join(__dirname, 'runtime/injectStylesIntoStyleTag.js')}`
        )};
        import content from ${loaderUtils.stringifyRequest(
          this,
          `!!${request}`
        )};
        var clonedContent = content;`

      return `
        ${ esModule ? esModleCode : commonModuleCode }

        console.log('api', api)

        // css content, 数组格式, why
        console.log('content', content)

        var options = ${JSON.stringify(options)};

        options.insert = ${insert};
        options.singleton = ${isSingleton};

        var update = api(content, options);

        var exported = content.locals ? content.locals : {};

        ${hmrCode}

        ${esModule ? 'export default' : 'module.exports ='} exported;
      `;  
    }
  }
};

export default loaderApi;
