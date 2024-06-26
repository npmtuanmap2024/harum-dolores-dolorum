/*eslint-env node */

const { join } = require('path');
const coverage_dir = join(__dirname, '.nyc_output');

module.exports = function (grunt) {
    grunt.initConfig({
        eslint: {
            target: [
                '*.js',
                'test/**/*.js',
                '!test/instrument/*.js',
                '!test/bundle.js',
                '!test/node_modules/**/*.js',
                'example/**/*.js',
                '!example/bundle.js'
            ]
        },

        exec: Object.fromEntries(Object.entries({
            bundle: {
                cmd: 'npx webpack --mode production --config test/webpack.config.cjs'
            },
            nw_build: {
                cmd: [
                    'rsync -a node_modules test --exclude chai --exclude check-error --exclude assertion-error --exclude loupe --delete --delete-excluded',
                    // Note: only @babel/plugin-transform-modules-commonjs will run since babel-plugin-istanbul skips node_modules by default
                    'for m in chai check-error assertion-error loupe; do BABEL_ENV=test npx babel --config-file ./.babelrc node_modules/$m --out-dir test/node_modules/$m --source-maps; sed s/module/commonjs/ node_modules/$m/package.json > test/node_modules/$m/package.json; done',
                    'mkdir -p test/node_modules/http2-duplex',
                    'cp test/instrument/server.* test/node_modules/http2-duplex',
                    'npx nwbuild test --mode build --glob false --platform linux --arch x64'
                ].join('&&')
            },
            test: {
                cmd: 'export TEST_ERR_FILE=/tmp/test_err_$$; ./out/http2-duplex-test; if [ -f $TEST_ERR_FILE ]; then exit 1; fi'
            },
            instrument: {
                cmd: 'npx babel client.js server.js --out-dir test/instrument --source-maps',
                options: {
                    env: Object.assign({}, process.env, {
                        BABEL_ENV: 'test'
                    })
                }
            },
            cover: {
                cmd: [
                    `mkdir -p '${coverage_dir}'`,
                    'npx grunt --gruntfile Gruntfile.cjs test'
                ].join('&&'),
                options: {
                    env: Object.assign({}, process.env, {
                        NYC_OUTPUT_DIR: coverage_dir
                    })
                }
            },
            cover_report: {
                cmd: 'npx nyc report -r lcov -r text'
            },
            cover_check: {
                cmd: 'npx nyc check-coverage --statements 100 --branches 100 --functions 100 --lines 100'
            },
            documentation: {
                cmd: 'asciidoc -b docbook -o - README.adoc | pandoc -f docbook -t gfm -o README.md'
            },
            example: {
                cmd: [
                    'npx webpack --mode production --config example/webpack.config.cjs',
                    'node example/server.js'
                ].join('&&')
            }
        }).map(([k, v]) => [k, { stdio: 'inherit', ...v }]))
    });

    grunt.loadNpmTasks('grunt-eslint');
    grunt.loadNpmTasks('grunt-exec');
    
    grunt.registerTask('lint', 'eslint');
    grunt.registerTask('test', [
        'exec:instrument',
        'exec:bundle',
        'exec:nw_build',
        'exec:test'
    ]);
    grunt.registerTask('coverage', [
        'exec:cover',
        'exec:cover_report',
        'exec:cover_check'
    ]);
    grunt.registerTask('docs', 'exec:documentation');
    grunt.registerTask('example', 'exec:example');
};
