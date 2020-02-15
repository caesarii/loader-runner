import { getCompiler, compile } from './helpers/index';

describe('validate options', () => {
  const tests = {
    url: {
      success: [true, false, () => {}],
      failure: ['true'],
    },
    import: {
      success: [true, false, () => {}],
      failure: ['true'],
    },
    modules: {
      success: [
        true,
        false,
        'global',
        'local',
        'pure',
        { mode: 'global' },
        { mode: 'local' },
        { mode: 'pure' },
        { localIdentName: '[path][name]__[local]--[hash:base64:5]' },
        { context: 'context' },
        { hashPrefix: 'hash' },
        { getLocalIdent: () => {} },
        { localIdentRegExp: 'page-(.*)\\.js' },
        { localIdentRegExp: /page-(.*)\.js/ },
      ],
      failure: [
        'true',
        'globals',
        'locals',
        'pures',
        { mode: true },
        { mode: 'globals' },
        { mode: 'locals' },
        { mode: 'pures' },
        { localIdentName: true },
        { context: true },
        { hashPrefix: true },
        { getLocalIdent: [] },
        { localIdentRegExp: true },
      ],
    },
    sourceMap: {
      success: [true, false],
      failure: ['true'],
    },
    localsConvention: {
      success: ['camelCase', 'camelCaseOnly', 'dashes', 'dashesOnly'],
      failure: ['unknown'],
    },
    importLoaders: {
      success: [false, 0, 1, 2],
      failure: ['1'],
    },
    onlyLocals: {
      success: [true, false],
      failure: ['true'],
    },
    esModule: {
      success: [true, false],
      failure: ['true'],
    },
    unknown: {
      success: [],
      failure: [1, true, false, 'test', /test/, [], {}, { foo: 'bar' }],
    },
  };

  function stringifyValue(value) {
    if (
      Array.isArray(value) ||
      (value && typeof value === 'object' && value.constructor === Object)
    ) {
      return JSON.stringify(value);
    }

    return value;
  }

  async function createTestCase(key, value, type) {
    it(`should ${
      type === 'success' ? 'successfully validate' : 'throw an error on'
    } the "${key}" option with "${stringifyValue(value)}" value`, async () => {
      const compiler = getCompiler('simple.js', { [key]: value });
      let stats;

      try {
        stats = await compile(compiler);
      } finally {
        if (type === 'success') {
          expect(stats.hasErrors()).toBe(false);
        } else if (type === 'failure') {
          const {
            compilation: { errors },
          } = stats;

          expect(errors).toHaveLength(1);
          expect(() => {
            throw new Error(errors[0].error.message);
          }).toThrowErrorMatchingSnapshot();
        }
      }
    });
  }

  for (const [key, values] of Object.entries(tests)) {
    for (const type of Object.keys(values)) {
      for (const value of values[type]) {
        createTestCase(key, value, type);
      }
    }
  }
});