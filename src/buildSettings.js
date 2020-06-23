const fs = require('fs')

let settingsObj = { 
    email: 'email',
    password: 'password', 
    rootDir: 'Creatives',
    exceptedDirs: ['html', 'src', 'source', 'assets', 'images', 'test', 'tmp']
}
 
let data = JSON.stringify(settingsObj, null, 2)

fs.writeFile('./settings.json', data, (err) => {
    if (err) throw err
    console.log('settings.json have been created')
})
