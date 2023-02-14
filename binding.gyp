{
  'targets': [
    {
      'target_name': 'addon',
      'sources': ['addon/src/main.cpp'],
      'include_dirs': ["<!@(node -p \"require('node-addon-api').include\")", 'addon/include', 'addon/include/deps', 'addon/include/deps/ck'],
      'dependencies': ["<!(node -p \"require('node-addon-api').gyp\")"],
      'libraries': [ '../addon/lib/macos-arm64/libportaudio.a'],
      'cflags!': ['-fno-exceptions'],
      'cflags_cc!': ['-fno-exceptions -pedantic -pedantic-errors'],
      'xcode_settings': {
        'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
        'CLANG_CXX_LIBRARY': 'libc++',
        'MACOSX_DEPLOYMENT_TARGET': '10.7'
      },
      'msvs_settings': {
        'VCCLCompilerTool': { 'ExceptionHandling': 1 },
      }
    }
  ]
}
