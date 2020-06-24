const {
  Builder,
  By,
  Key,
  until
} = require('selenium-webdriver')
const path = require('path')
const fs = require('fs')
const chalk = require('chalk')
const zipper = require("zip-local")
const glob = require('glob')
const Nightmare = require('nightmare')
const sharp = require('sharp')
const inquirer = require('inquirer')
const settings = require('../settings.json')
require('chromedriver')

let driver
const myEmail = settings.email
const myPassword = settings.password
const rootDir = settings.rootDir
const exceptedDirs = settings.exceptedDirs
const currentDir = process.cwd()

//for backups
const sizeImg = 39000
const qualityImg = 100

const durationObj = {}
durationObj.startProgramTime = new Date().getTime()
//write all data from the folder where the script has been running to object 'store'
const store = {}
store.advertiser = findDirAfter(rootDir, currentDir)
store.campaign = findDirAfter(store.advertiser, currentDir)
store.creatives = []

start()

async function start() {
  glob(process.cwd() + '/**/*.html', async function (err, files) {

    if (err) {
      console.log(err)
    } else {
      let filesToUpload
      const filteredFilesArr = deleteExcludedDirs(files, exceptedDirs)

      if (filteredFilesArr.length <= 0) throw new Error('No creatives to upload')
      
      const askBack = await inquirer.prompt([{
        type: 'confirm',
        message: 'Do you want to make backups?',
        name: 'backup'
      }])

      if (askBack.backup) {
        const askTime = await inquirer.prompt([{
          type: 'input',
          message: 'Enter the waiting time.',
          name: 'waitTime',
          default: 30,
          validate: function (value) {
            if (Number.isInteger(+value)) return true

            return chalk.red('Please enter an integer!')
          }
        }])

        const waitTime = Math.abs(askTime.waitTime) * 1000
        const promises = []

        for (file of filteredFilesArr) {
          promises.push(screenShorEach(file, waitTime))
        }

        console.log('Creation in progress, please wait...')
        
        await Promise.all(promises).then(() => {
          console.log(chalk.green('Backups are ready.'))
        })

        filesToUpload = await promptUpload(filteredFilesArr)
        const fileteredFilesArr = filterFiles(filteredFilesArr, filesToUpload)
        buildStore(fileteredFilesArr, store.advertiser)
        runUpload(store)


      } else {
        filesToUpload = await promptUpload(filteredFilesArr)
        const fileteredFilesArr = filterFiles(filteredFilesArr, filesToUpload)
        buildStore(fileteredFilesArr, store.advertiser)
        runUpload(store)
      }
    }
  })
}

function filterFiles(initArray, promptArray) {
  let filteredArr = []

  for (let i = 0; i < initArray.length; i++) {
    for (let j = 0; j < promptArray.length; j++) {
      if (initArray[i].indexOf(promptArray[j]) !== -1) {
        filteredArr.push(initArray[i])
      }
    }
  }

  filteredArr = filteredArr.map(item => {
    let splittedItem = item.split('/')

    splittedItem = splittedItem.splice(0, splittedItem.length - 1).join('/')

    return splittedItem
  })

  return filteredArr
}

function deleteExcludedDirs(initArray, exceptionsArray) {
  const filteredArray = []
  const cloneInitArr = JSON.parse(JSON.stringify(initArray))

  for (let i = 0; i < initArray.length; i++) {
    let initArraySplittedItem = initArray[i].toLowerCase().split('/')
   
    for (let j = 0; j < exceptionsArray.length; j++) {

      if (initArraySplittedItem.includes(exceptionsArray[j].toLowerCase())) {
        cloneInitArr[i] = 'deleted'
      }
    }
  }

  cloneInitArr.forEach(item => {
    if (item !== 'deleted') filteredArray.push(item)
  })

  return filteredArray
}

async function promptUpload(files) {
  const filteredFilesArr = files.map(file => {
    const splittedFilePath = file.split('/')
    const advertiserIndex = splittedFilePath.indexOf(store.advertiser)
    const creativeNameSliced = splittedFilePath.slice(advertiserIndex)

    creativeNameSliced.pop()

    const creativeName = creativeNameSliced.join('/')

    return creativeName
  })

  const askUploadAll = await inquirer.prompt([{
    type: 'confirm',
    message: 'Do you want to upload all your creatives?',
    name: 'uploadConfirm'
  }])

  if (!askUploadAll.uploadConfirm) {
    const askUploadChoose = await inquirer.prompt([{
      type: 'checkbox',
      message: 'Select the dimensions to upload!',
      name: 'uploadConfirm',
      choices: filteredFilesArr,
      validate: function (answer) {
        if (answer.length < 1) {
          return chalk.red('You must choose at least one creative for upload.')
        }

        return true;
      }
    }])

    return askUploadChoose.uploadConfirm

  } else {
    return files
  }
}

//used to define advertiser and campaign relative to the folder from settings.json
function findDirAfter(parentDir, currentPath) {
  const splittedCurrentPath = currentPath.split('/')
  const findParentDir = (element) => element.toLowerCase() === parentDir.toLowerCase()
  const indexParentDir = splittedCurrentPath.findIndex(findParentDir)
  const dirNameAfterParentDir = splittedCurrentPath[indexParentDir + 1]

  return dirNameAfterParentDir
}

function buildStore(filesArr, advertiser) {
  filesArr.forEach(creative => {
    let creativeSplitted = creative.split('/')
    let creativeName = 'DELVE|'

    const creativesInfo = {}
    const zipPath = zipFiles(creative)
    const creativeDimensions = creativeSplitted[creativeSplitted.length - 1].split('x')
    const creativeWidth = creativeDimensions[0]
    const creativeHeight = creativeDimensions[1]
    const campaignIndex = creativeSplitted.findIndex(elem => elem === advertiser)
    
    creativeSplitted.splice(0, campaignIndex)
    creativeSplitted = creativeSplitted.join('|')

    creativeName = creativeName + creativeSplitted
    creativeName = creativeName.replace(/\s/g, '')

    creativesInfo.creativeName = creativeName
    creativesInfo.creativeWidth = creativeWidth
    creativesInfo.creativeHeight = creativeHeight
    creativesInfo.folderSize = 0
    creativesInfo.numOfFiles = 0

    fs.readdirSync(creative).forEach(file => {
    if (file === '.DS_Store' || path.extname(file) === '.zip') return

    let filePath = path.resolve(creative, file)
    let stats = fs.statSync(filePath)
    let fileSizeInKBytes = stats["size"]

    creativesInfo.folderSize += fileSizeInKBytes
    creativesInfo.numOfFiles++
    })

  creativesInfo.folderSize = Math.round(creativesInfo.folderSize / 1000) + 'KB'
  creativesInfo.zipFile = zipPath
   
  store.creatives.push(creativesInfo)
  })
}

async function runUpload(store) {
  const updateMessage = 'updated'
  const uploadMessage = 'uploaded'

  try {
    driver = new Builder().forBrowser('chrome').build()
    await loginToGoogleAccount(myEmail, myPassword)
    await goToCampaignsTab(store.advertiser, store.campaign)

    for (creative of store.creatives) {

      durationObj.startUploadCreativeTime = new Date().getTime()

      let creativeIsStillThere = await isCreaviseAlreadyCreated(creative.creativeName)

      if (creativeIsStillThere) {
        await updateCreative(creative, updateMessage)
      } else {
        await uploadCreative(creative, uploadMessage)
      }
    }

    durationObj.endProgramTime = new Date().getTime()

    const totalDuration = getDuration(durationObj.startProgramTime, durationObj.endProgramTime)
    console.log(`Program execution time - ${chalk.bold.blue(totalDuration)}\n`)
  } catch (err) {
    console.log(err.stack)
    //delete all zip if there was an error
    store.creatives.forEach(creative => {
      fs.unlink(creative.zipFile, (err) => {
        if (err) {
          return
        }
      })
    })
  }
}

async function loginToGoogleAccount(email, password) {
  await driver.manage().window().maximize()
  await driver.get('https://accounts.google.com/')
  //enter email
  await waitAndDoAction(false, 'name', 'identifier', 30000, email)
  //enter password
  await waitAndDoAction(false, 'name', 'password', 30000, password)
  await driver.wait(until.titleIs('Google Account'), 10000);
  await driver.get('https://www.google.com/doubleclick/studio/#advertisers:')
}

//search, create or go to the campaigns tab
async function goToCampaignsTab(advertiser, campaign) {
  //searching advertizer
  await waitAndDoAction(false, 'id', 'gwt-debug-table-search-input', 30000, advertiser)
  //click on advertizer
  await waitAndDoAction(false, 'xpath', `//*[text()='${advertiser}']`, 30000, null)
  //searching campaign
  await waitAndDoAction(false, 'id', 'gwt-debug-table-search-input', 30000, campaign)

  //checking whether the campaign is present. If not it creates a new one below
  let campaignIsStillThere;
  try {
    //need to wait a few seconds to find out if such a campaign. Because AJAX is used
    await driver.sleep(3000)
    campaignIsStillThere = await driver.findElement(By.xpath(`//*[text()='${campaign}']`)).isDisplayed();
  } catch (e) {
    campaignIsStillThere = false;
  }

  if (campaignIsStillThere) {
    await driver.findElement(By.xpath(`//*[text()='${campaign}']`)).click()
  } else {
    await driver.findElement(By.id('gwt-debug-table-button')).click()

    //check if the fields of some input are not still empty. Because AJAX is used
    while (true) {
      let checkInputsAreNotEmpty = await driver.executeScript('let inputAccountName = document.getElementById("gwt-debug-new-campaign-accountText"); let inputAdvertiserName = document.getElementById("gwt-debug-new-campaign-advertiserText"); return inputAccountName.value && inputAdvertiserName.value')

      if (checkInputsAreNotEmpty) break
    }

    //send keys in campaign name input
    await waitAndDoAction(false, 'id', 'gwt-debug-new-campaign-campaignText', 30000, campaign)
    //save campaign
    await driver.findElement(By.id('gwt-debug-save-button')).click()
  }
}

async function isCreaviseAlreadyCreated(creative) {
  //searching creative
  let inputSearchCreative = await waitAndDoAction(true, 'id', 'gwt-debug-table-search-input', 30000, null)

  // if the input is disabled it means that there aren't any creatives here yet
  let isInputSearchDisabled = await driver.executeScript('let input = document.getElementById("gwt-debug-table-search-input").disabled; return input;')

  if (isInputSearchDisabled) return false

  await inputSearchCreative.sendKeys(creative, Key.RETURN)

  let creativeIsStillThere;
  try {
    //need to wait a few seconds to find out if such a company. Because AJAX is used
    await driver.sleep(3000)
    creativeIsStillThere = await driver.findElement(By.xpath(`//*[text()='${creative}']`)).isDisplayed();
  } catch (e) {
    creativeIsStillThere = false;
  }

  return creativeIsStillThere
}

async function updateCreative(creative, message) {
  await driver.findElement(By.xpath(`//*[text()='${creative.creativeName}']`)).click()

  const isTheCreativeNotEmpty = await isCreativeEmpty()

  if (isTheCreativeNotEmpty) await deleteAllFilesOfCreative()

  await uploadFiles(creative.zipFile, creative.creativeName, message, creative.numOfFiles, creative.folderSize)

}

async function isCreativeEmpty() {
  let deleteBtnIsStillThere;
  try {
    //need to wait a few seconds to find out if such a delete button. Because AJAX is used
    await driver.sleep(3000)
    deleteBtnIsStillThere = await driver.findElement(By.id('gwt-debug-creativeworkflow-delete-button')).isDisplayed();
  } catch (e) {
    deleteBtnIsStillThere = false;
  }

  return deleteBtnIsStillThere
}

async function deleteAllFilesOfCreative() {
  //click on select all files checkbox
  await waitAndDoAction(false, 'id', 'gwt-debug-select-all-checkbox-input', 30000, null)
  //click on delete files button
  await waitAndDoAction(false, 'id', 'gwt-debug-creativeworkflow-delete-button', 30000, null)
}

async function uploadCreative(creative, message) {
  await createNewCreative(creative.creativeName, creative.creativeWidth, creative.creativeHeight)
  await uploadFiles(creative.zipFile, creative.creativeName, message, creative.numOfFiles, creative.folderSize)
}

async function createNewCreative(creativeName, creativeWidth, creativeHeight) {
  //wait when the button "new creative" appears and click on it
  await waitAndDoAction(false, 'id', 'gwt-debug-new-creative-dropdown-new-creative-button', 30000, null)
  //waiting for the button "Next" to appear. Hence this means that the entire page has loaded
  let buttonNewCretiveNext = await waitAndDoAction(true, 'id', 'gwt-debug-creativeworkflow-next-button', 30000, null)

  //check if the fields of some input are not still empty. Because AJAX is used
  while (true) {
    let checkInputsAreNotEmpty = await driver.executeScript('let inputAccountName = document.getElementById("gwt-debug-creativeDetail-accountText"); let inputAdvertiserName = document.getElementById("gwt-debug-creativeDetail-advertiserText"); let inputCampaignName = document.getElementById("gwt-debug-creativeDetail-campaignText"); return inputAccountName.value && inputAdvertiserName.value && inputCampaignName.value')

    if (checkInputsAreNotEmpty) break
  }

  //send keys in creative name input
  await waitAndDoAction(false, 'id', 'gwt-debug-creativeDetail-nameText', 30000, creativeName)
  //click on the "size button" 
  await driver.findElement(By.id('gwt-debug-creativeDetail-sizeText')).click()
  //choose user-defined dimensions option
  await waitAndDoAction(false, 'id', 'gwt-debug-creativeDetail-sizeText-CUSTOM', 30000, null)
  //send keys in creative width input
  await waitAndDoAction(false, 'id', 'gwt-debug-creativeDetail-widthText', 30000, creativeWidth)
  //send keys in creative height input
  await waitAndDoAction(false, 'id', 'gwt-debug-creativeDetail-heightText', 30000, creativeHeight)
  //save creative
  await buttonNewCretiveNext.click()
}

async function uploadFiles(zipFile, creativeName, message, numOfFiles, folderSize) {
  //waiting for the "drop zone" element
  await waitAndDoAction(true, 'id', 'gwt-debug-creativeworkflow-drop-zone', 30000, null)

  //make visible input[type='file'] and upload files
  await driver.executeScript('document.querySelector("input[type=file]").style.height = "50px"; document.querySelector("input[type=file]").style.width = "50px"; document.querySelector("input[type=file]").style.display="block"; document.querySelector("input[type=file]").style.visibility="visible";  ')
  await driver.findElement(By.xpath("//input[@type='file']")).sendKeys(`${zipFile}`)

  //waiting for all files to load
  await waitAndDoAction(true, 'xpath', '//*[text()="Upload complete"]', 120000, null)

  //delete temporary archive
  fs.unlink(zipFile, (err) => {
    if (err) {
      console.error(err)
      return
    }
  })

  await driver.sleep(2000)
  await checkingForErrors(creativeName, message, numOfFiles, folderSize)
  await driver.sleep(3000)
  //back to list with creatives
  await driver.findElement(By.id('gwt-debug--breadcrumbs-link-2')).click()
  await driver.sleep(3000)
}

async function checkingForErrors(creativeName, message, numOfFiles, folderSize) {
  //checking if there is a bug
  let strSrciptGetBugMessage = 'let bugConsole = document.getElementById("gwt-debug-message-console"); let bugs = bugConsole.getElementsByClassName("AMO0RV-p-i"); let bugMessageArr = []; for (let bug of bugs) {bugMessageArr.push(bug.innerHTML)}; return bugMessageArr;'
  let bugMessageArr = await driver.executeScript(strSrciptGetBugMessage)

  if (bugMessageArr.length) {
    console.log(`\n${chalk.red('Rejected => ')} ${creativeName}`)

    for (let bug of bugMessageArr) {
      console.log(`${chalk.red('Message => ')} ${bug}\n`)
    }

  } else {
    durationObj.endUploadCreativeTime = new Date().getTime()

    let uploadingDuration = getDuration(durationObj.startUploadCreativeTime, durationObj.endUploadCreativeTime)

    await checkBackup()

    console.log(`\n${chalk.green(`Creative ${message} `)}` + ` ${chalk.blue(`(Time: ${uploadingDuration}, Files: ${numOfFiles}, Size: ${folderSize})`)}` + `${chalk.green(` => ${creativeName}`)}\n`)
  }
}

function getDuration(start, end) {
  let durationSeconds = (end - start) / 1000
  let durationMinutes = Math.trunc(durationSeconds / 60)
  let result = `${durationMinutes}m ${Math.trunc(durationSeconds - (durationMinutes * 60))}s`

  return result
}

async function checkBackup() {
  const checkBackupFunc = 'const size = document.getElementById("gwt-debug-dclk-creative-properties-size").innerHTML;const aTags = document.getElementsByTagName("a");const searchText = "backup_" + size + ".jpg";let found;for (let i = 0; i < aTags.length; i++) {if (aTags[i].textContent == searchText) {found = aTags[i];break;}}const link = found.parentElement.nextElementSibling.nextElementSibling.nextElementSibling.getElementsByTagName("a")[0].click()'

  await driver.executeScript(checkBackupFunc)
}

function zipFiles(creativePath) {
  const zipName = 'forUpload.zip'
  const zipPath = path.resolve(creativePath, zipName)

  zipper.sync.zip(creativePath).compress().save(zipPath)

  return zipPath
}

//if the first param is false - func doesn't click or send keys. It means need to wait to appear an element
//if the first param is true - func makes "click" if keys is "null". Or it "send keys" if keys is pointed.
async function waitAndDoAction(onlyWaitFlag, by, identifier, waitTime, keys) {
  let byMethod

  switch (by) {
    case 'name':
      byMethod = By.name
      break;

    case 'id':
      byMethod = By.id
      break;

    case 'xpath':
      byMethod = By.xpath
      break;
  }

  const byElement = byMethod(identifier)
  await driver.wait(until.elementLocated(byElement, waitTime))

  const element = driver.findElement(byElement)
  await driver.wait(until.elementIsVisible(element), waitTime)

  if (!onlyWaitFlag) {
    keys === null ? await element.click() : await element.sendKeys(keys, Key.RETURN)
  }

  return element
}

//GET BACKUPS
async function screenShorEach(file, waitTime) {
  const firstWait = Math.ceil(waitTime / 2)
  const secondWait = waitTime - firstWait
  const pathOfHtml = 'file://' + file
  const splittedPathFile = file.split('/')
  const pathFolder = splittedPathFile.slice(0, splittedPathFile.length - 1).join('/') + '/'

  return new Promise((resolve) => {
    resolve(screenShot(pathOfHtml, pathFolder, firstWait, secondWait))
  })
}

async function screenShot(pathFile, pathFolder, firstWait, secondWait) {
  const nightmare = new Nightmare({
    show: false,
    frame: false,
    maxHeight: 16384,
    maxWidth: 16384
  })
  let shotName
  const dimensionsImg = {}

  // get dimensions of the creative
  await nightmare.goto(pathFile)
    .wait('body')
    .evaluate(function () {
      const wrapper = document.querySelector('#wrapper')

      return {
        height: wrapper.clientHeight,
        width: wrapper.clientWidth
      }
    })
    .then(dimensions => {
      const dimensionsName = dimensions.width + 'x' + dimensions.height

      shotName = 'backup_' + dimensionsName + '.jpg'

      dimensionsImg.width = dimensions.width
      dimensionsImg.height = dimensions.height
      ////console.log('Dimensions: ' + dimensionsName)
    })

  //make a screenshot and put it to the buffer
  const buffer = await nightmare.viewport(dimensionsImg.width, dimensionsImg.height)
    .wait(firstWait)
    .wait(secondWait)
    .screenshot()
    .end()

  shotName = pathFolder + shotName

  // resize and set the quality of the screenshot less than 39KB
  sharpImage(buffer, qualityImg, dimensionsImg.width, dimensionsImg.height, shotName, sizeImg)
}

function sharpImage(img, qualityImg, widthImg, heightImg, nameImg, sizeImg) {
  sharp(img)
    .jpeg({
      quality: qualityImg,
      progressive: true
    })
    .resize({
      width: widthImg,
      height: heightImg,
    })
    .toFile(nameImg)
    .then(function (newFileInfo) {
      if (newFileInfo.size < sizeImg) {
        ////console.log('CREATED =>', `${widthImg}x${heightImg}`)
        return
      } else {
        sharpImage(img, qualityImg - 1, widthImg, heightImg, nameImg, sizeImg)
      }
    })
    .catch(function (err) {
      console.log(err)
    })
}