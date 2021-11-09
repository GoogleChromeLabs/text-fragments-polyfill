import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';

export default [
  {
    input: 'src/text-fragments.js',
    output: {
      file: 'dist/text-fragments.js',
      format: 'es',
      plugins: [terser()],
    },
    plugins: [
      resolve(),
      commonjs(),
      babel({
        babelHelpers: 'bundled',
        exclude: 'node_modules/**',
        presets: [
          [
            '@babel/preset-env',
            {
              corejs: 3,
              modules: false,
              useBuiltIns: 'usage',
            },
          ],
        ],
      }),
    ],
  },
  {
    input: 'src/fragment-generation-utils.js',
    output: {
      file: 'dist/fragment-generation-utils.js',
      format: 'es',
      plugins: [terser()],
    },
  },
];
