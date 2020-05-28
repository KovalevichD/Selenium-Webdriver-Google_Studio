//write your data in variables to enter your Google account
const myEmail = 'email'
const myPassword = 'password'

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
require('chromedriver')
const driver = new Builder().forBrowser('chrome').build()
const updateOnlySpecified = process.argv[2] || false

const durationObj = {}
durationObj.startProgramTime = new Date().getTime()

//write all data from the folder where the script has been running to object 'store'
const exceptedDirs = ['html', 'src', 'source', 'assets', 'images', 'test', 'tmp']
const store = {}
const cuurentDir = process.cwd()
const cuurentDirSplitted = cuurentDir.split('/')

store.advertiser = cuurentDirSplitted[cuurentDirSplitted.length - 2]
store.campaign = cuurentDirSplitted[cuurentDirSplitted.length - 1]
store.creatives = []

fs.readdirSync(cuurentDir).forEach(creative => {
  let creativesInfo = {}
  let creativePath = path.resolve(cuurentDir, creative)
  let isExceptedDir = isException(exceptedDirs, creative)

  if (!fs.statSync(creativePath).isDirectory() || isExceptedDir) return

  let needToUpload = isNeedToUpload(creative, updateOnlySpecified)
  if (!needToUpload) return
  
  let zipPath = zipFiles(creativePath)

  let creativeNameSplitted = creative.split('|')
  let creativeDimensions = creativeNameSplitted[creativeNameSplitted.length - 1].split('x')
  let creativeWidth = creativeDimensions[0]
  let creativeHeight = creativeDimensions[1]

  creativesInfo.creativeName = creative
  creativesInfo.creativeWidth = creativeWidth
  creativesInfo.creativeHeight = creativeHeight
  creativesInfo.folderSize = 0
  creativesInfo.numOfFiles = 0

  fs.readdirSync(creativePath).forEach(file => {
    if (file === '.DS_Store' || path.extname(file) === '.zip') return

    let filePath = path.resolve(creativePath, file)
    let stats = fs.statSync(filePath)
    let fileSizeInKBytes = stats["size"]

    creativesInfo.folderSize += fileSizeInKBytes
    creativesInfo.numOfFiles++
  })

  creativesInfo.folderSize = Math.round(creativesInfo.folderSize / 1000) + 'KB'
  creativesInfo.zipFile = zipPath

  store.creatives.push(creativesInfo)
})

run(store, updateOnlySpecified)

async function run(store, updateOnly) {
  const updateMessage = 'updated'
  const uploadMessage = 'uploaded'

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

function isNeedToUpload(creativeFullName, updateOnly) {
  if (!updateOnly) return true
  const updateOnlySplitted = updateOnly.split(',')

  for (dimensions of updateOnlySplitted) {
    let isNeedToUploadBoolean = creativeFullName.includes(dimensions)

    if (isNeedToUploadBoolean) return true
  }

  return false
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

function isException(arrOfExcepts, currentFolderName) {
  const isExcepted = arrOfExcepts.includes(currentFolderName.toLowerCase())

  return isExcepted
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

  switch(by) {
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