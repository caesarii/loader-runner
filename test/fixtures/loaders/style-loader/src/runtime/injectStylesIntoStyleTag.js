const isOldIE = (function isOldIE() {
  let memo;

  return function memorize() {
    if (typeof memo === 'undefined') {
      // Test for IE <= 9 as proposed by Browserhacks
      // @see http://browserhacks.com/#hack-e71d8692f65334173fee715c222cb805
      // Tests for existence of standard globals is to allow style-loader
      // to operate correctly into non-standard environments
      // @see https://github.com/webpack-contrib/style-loader/issues/177
      memo = Boolean(window && document && document.all && !window.atob);
    }

    return memo;
  };
})();

const getTarget = (function getTarget() {
  const memo = {};

  return function memorize(target) {
    if (typeof memo[target] === 'undefined') {
      let styleTarget = document.querySelector(target);

      // Special case to return head of iframe instead of iframe itself
      if (
        window.HTMLIFrameElement &&
        styleTarget instanceof window.HTMLIFrameElement
      ) {
        try {
          // This will throw an exception if access to iframe is blocked
          // due to cross-origin restrictions
          styleTarget = styleTarget.contentDocument.head;
        } catch (e) {
          // istanbul ignore next
          styleTarget = null;
        }
      }

      memo[target] = styleTarget;
    }

    return memo[target];
  };
})();

// stylesInDom 中的元素会对应到 <style>, updater 中定义了更新方式, 每个元素对应一个<style> 还是都在一个 <style>, 
// 元素数据结构
// {
//   identifier, // 样式表 id
//   updater: addStyle(obj, options),
//   references: 1, // 引用次数
// }
const stylesInDom = [];

function getIndexByIdentifier(identifier) {
  let result = -1;

  for (let i = 0; i < stylesInDom.length; i++) {
    if (stylesInDom[i].identifier === identifier) {
      result = i;
      break;
    }
  }

  return result;
}

// modulesToDom 用于将 css module 数据转换为 style-loader 内部使用的 stylesInDom 数据
// 如果样式表已经在 dom 中, 则调用 addStyle 返回的更新器进行更新, 其中会判断是否需要更新
// 如果样式表没有插入 dom, 则调用 addStyle 插入dom并得到更新器
// modulesToDom 返回 identifiers 列表
function modulesToDom(list, options) {
  // list 中每条数据表示一个样式表(?), 并用 id 区分
  // 在这里用 id-count 定义了新的 id, identifier
  // id 计数器
  const idCountMap = {};
  // identifier 列表
  const identifiers = [];

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    // id
    const id = options.base ? item[0] + options.base : item[0];
    const count = idCountMap[id] || 0;
    // 定义 identifier, 注意其格式
    const identifier = `${id} ${count}`;

    // id 计数
    idCountMap[id] = count + 1;

    // 根据 identifier 查询其在 stylesInDom 中的下标
    const index = getIndexByIdentifier(identifier);
    // 1 是 css 文本, 不确定 2, 3 是什么
    const obj = {
      css: item[1],
      media: item[2],
      sourceMap: item[3],
    };

    if (index !== -1) {
      stylesInDom[index].references++;
      stylesInDom[index].updater(obj);
    } else {
      stylesInDom.push({
        identifier,
        updater: addStyle(obj, options),
        references: 1,
      });
    }

    identifiers.push(identifier);
  }

  return identifiers;
}

function insertStyleElement(options) {
  const style = document.createElement('style');
  const attributes = options.attributes || {};

  if (typeof attributes.nonce === 'undefined') {
    const nonce =
      typeof __webpack_nonce__ !== 'undefined' ? __webpack_nonce__ : null;

    if (nonce) {
      attributes.nonce = nonce;
    }
  }

  Object.keys(attributes).forEach((key) => {
    style.setAttribute(key, attributes[key]);
  });

  if (typeof options.insert === 'function') {
    options.insert(style);
  } else {
    const target = getTarget(options.insert || 'head');

    if (!target) {
      throw new Error(
        "Couldn't find a style target. This probably means that the value for the 'insert' parameter is invalid."
      );
    }

    target.appendChild(style);
  }

  return style;
}

function removeStyleElement(style) {
  // istanbul ignore if
  if (style.parentNode === null) {
    return false;
  }

  style.parentNode.removeChild(style);
}

/* istanbul ignore next  */
const replaceText = (function replaceText() {
  const textStore = [];

  return function replace(index, replacement) {
    textStore[index] = replacement;

    return textStore.filter(Boolean).join('\n');
  };
})();

function applyToSingletonTag(style, index, remove, obj) {
  const css = remove
    ? ''
    : obj.media
    ? `@media ${obj.media} {${obj.css}}`
    : obj.css;

  // For old IE
  /* istanbul ignore if  */
  if (style.styleSheet) {
    style.styleSheet.cssText = replaceText(index, css);
  } else {
    const cssNode = document.createTextNode(css);
    const childNodes = style.childNodes;

    if (childNodes[index]) {
      style.removeChild(childNodes[index]);
    }

    if (childNodes.length) {
      style.insertBefore(cssNode, childNodes[index]);
    } else {
      style.appendChild(cssNode);
    }
  }
}

function applyToTag(style, options, obj) {
  let css = obj.css;
  const media = obj.media;
  const sourceMap = obj.sourceMap;

  if (media) {
    style.setAttribute('media', media);
  } else {
    style.removeAttribute('media');
  }

  if (sourceMap && btoa) {
    css += `\n/*# sourceMappingURL=data:application/json;base64,${btoa(
      unescape(encodeURIComponent(JSON.stringify(sourceMap)))
    )} */`;
  }

  // For old IE
  /* istanbul ignore if  */
  if (style.styleSheet) {
    style.styleSheet.cssText = css;
  } else {
    while (style.firstChild) {
      style.removeChild(style.firstChild);
    }

    style.appendChild(document.createTextNode(css));
  }
}

let singleton = null;
let singletonCounter = 0;

// addStyle 将样式更新到 dom, 并返回一个更新器用于下一次更新
function addStyle(obj, options) {
  let style;
  let update;
  let remove;

  if (options.singleton) {
    const styleIndex = singletonCounter++;

    style = singleton || (singleton = insertStyleElement(options));

    update = applyToSingletonTag.bind(null, style, styleIndex, false);
    remove = applyToSingletonTag.bind(null, style, styleIndex, true);
  } else {
    style = insertStyleElement(options);

    update = applyToTag.bind(null, style, options);
    remove = () => {
      removeStyleElement(style);
    };
  }

  update(obj);

  return function updateStyle(newObj) {
    if (newObj) {
      if (
        newObj.css === obj.css &&
        newObj.media === obj.media &&
        newObj.sourceMap === obj.sourceMap
      ) {
        return;
      }

      update((obj = newObj));
    } else {
      remove();
    }
  };
}

module.exports = (list, options) => {
  console.log('injectStyles', list)
  options = options || {};

  // Force single-tag solution on IE6-9, which has a hard limit on the # of <style>
  // tags it will allow on a page
  if (!options.singleton && typeof options.singleton !== 'boolean') {
    options.singleton = isOldIE();
  }

  list = list || [];

  // 到这里就已经插入 dom 了
  let lastIdentifiers = modulesToDom(list, options);

  console.log('lastIdentifiers', lastIdentifiers)
  console.log('stylesInDom', stylesInDom)

  // 以下热更逻辑
  return function update(newList) {
    console.log('hot update', newList)
    newList = newList || [];

    if (Object.prototype.toString.call(newList) !== '[object Array]') {
      return;
    }

    // 引用次数 -1, stylesInDom 是待消费的队列 ?
    for (let i = 0; i < lastIdentifiers.length; i++) {
      const identifier = lastIdentifiers[i];
      const index = getIndexByIdentifier(identifier);

      stylesInDom[index].references--;
    }

    const newLastIdentifiers = modulesToDom(newList, options);
    console.log('newLastIdentifiers', newLastIdentifiers)

    for (let i = 0; i < lastIdentifiers.length; i++) {
      const identifier = lastIdentifiers[i];
      const index = getIndexByIdentifier(identifier);

      if (stylesInDom[index].references === 0) {
        stylesInDom[index].updater();
        stylesInDom.splice(index, 1);
      }
    }

    lastIdentifiers = newLastIdentifiers;
  };
};
