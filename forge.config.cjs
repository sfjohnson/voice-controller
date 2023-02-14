module.exports = {
  packagerConfig: {
    ignore: [
      /^\/src/,
      /^\/build/,
      /^\/bin/,
      /^\/addon/,
      /^\/\./,
      /^\/[^/]+\.ts$/,
      /^\/[^/]+\.js$/,
      /^\/[^/]+\.html$/,
      /^\/[^/]*config[^/]*\.(cjs|json)$/
    ]
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin']
    }
  ],
}
