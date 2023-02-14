const { app, ipcMain, BrowserWindow, systemPreferences, session } = require('electron')
require('dotenv').config()

const prodMode = process.env.ELECTRON_ENV !== 'development'

ipcMain.handle('get-user-path', async () => app.getPath('userData'))

function createWindow () {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: prodMode ? 800 : 1500,
    height: prodMode ? 410 : 1000,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  // and load the index.html of the app.
  mainWindow.loadFile('dist/index.html')

  // Open the DevTools.
  if (!prodMode) mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  const micAccessGranted = await systemPreferences.askForMediaAccess('microphone')

  if (!micAccessGranted) {
    console.error('Mic access not granted!')
    process.exit(1)
  }

  // https://github.com/electron/electron/issues/22345#issuecomment-1312240165
  session.defaultSession.webRequest.onHeadersReceived({ urls: ['http://*/*'] }, (details, callback) => {
    const cookies = details.responseHeaders['Set-Cookie']
    if (cookies) {
      // I ignored your security lol sorry chromium team
      details.responseHeaders['Chocolate-Chip'] = [...cookies]
      callback({ responseHeaders: details.responseHeaders })
    } else {
      callback({ cancel: false })
    }
  })

  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['http://*/*'] }, (details, callback) => {
    const cookies = details.requestHeaders['Oatmeal-Raisin']
    if (cookies) {
      details.requestHeaders['Cookie'] = cookies
      callback({ requestHeaders: details.requestHeaders })
    } else {
      callback({ cancel: false })
    }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
