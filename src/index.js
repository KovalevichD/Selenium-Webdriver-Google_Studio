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

  let creativeNameSplitted = creative.split('|')
  let creativeDimensions = creativeNameSplitted[creativeNameSplitted.length - 1].split('x')
  let creativeWidth = creativeDimensions[0]
  let creativeHeight = creativeDimensions[1]
  let pathsOfFilesArr = []
  let namesOfFilesArr = []
  let filesInString = ''

  creativesInfo.creativeName = creative
  creativesInfo.creativeWidth = creativeWidth
  creativesInfo.creativeHeight = creativeHeight
  creativesInfo.folderSize = 0

  fs.readdirSync(creativePath).forEach(file => {
    if (file === '.DS_Store') return

    let filePath = path.resolve(creativePath, file)

    pathsOfFilesArr.push(filePath)
    namesOfFilesArr.push(file)

    let stats = fs.statSync(filePath)
    let fileSizeInKBytes = stats["size"]

    creativesInfo.folderSize += fileSizeInKBytes
  })

  creativesInfo.folderSize = Math.round(creativesInfo.folderSize / 1000) + 'KB'

  //creating string of files for multiple input.SendKeys
  for (let i = 0; i < pathsOfFilesArr.length; i++) {
    i !== pathsOfFilesArr.length - 1 ? filesInString = filesInString + pathsOfFilesArr[i] + '\n' : filesInString = filesInString + pathsOfFilesArr[i]
  }

  creativesInfo.numOfFiles = pathsOfFilesArr.length
  creativesInfo.filesInString = filesInString
  creativesInfo.pathsOfFilesArr = pathsOfFilesArr
  creativesInfo.namesOfFilesArr = namesOfFilesArr

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

    let needToUpload = isNeedToUpload(creative.creativeName, updateOnly)

    if (updateOnlySpecified && !needToUpload) continue

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

  let byGoogleAccountEmail = By.name('identifier');
  await driver.wait(until.elementLocated(byGoogleAccountEmail, 30000));
  let googleAccountEmail = driver.findElement(byGoogleAccountEmail);
  await driver.wait(until.elementIsVisible(googleAccountEmail), 30000);
  googleAccountEmail.sendKeys(email, Key.RETURN)

  let byGoogleAccountPassword = By.name('password');
  await driver.wait(until.elementLocated(byGoogleAccountPassword, 30000));
  let googleAccountPassword = driver.findElement(byGoogleAccountPassword);
  await driver.wait(until.elementIsVisible(googleAccountPassword), 30000);
  googleAccountPassword.sendKeys(password, Key.RETURN)

  await driver.wait(until.titleIs('Google Account'), 10000);

  await driver.get('https://www.google.com/doubleclick/studio/#advertisers:')
}

//search, create or go to the campaigns tab
async function goToCampaignsTab(advertiser, campaign) {
  //searching advertizer
  let bySearchAdvertizer = By.id('gwt-debug-table-search-input');
  await driver.wait(until.elementLocated(bySearchAdvertizer, 30000));
  let inputSearchAdvertizer = driver.findElement(bySearchAdvertizer);
  await driver.wait(until.elementIsVisible(inputSearchAdvertizer), 30000);
  inputSearchAdvertizer.sendKeys(advertiser, Key.RETURN)

  //click on advertizer
  let byAdvertizer = By.xpath(`//*[text()='${advertiser}']`);
  await driver.wait(until.elementLocated(byAdvertizer, 30000));
  let linkAdvertizer = driver.findElement(byAdvertizer);
  await driver.wait(until.elementIsVisible(linkAdvertizer), 30000);
  await linkAdvertizer.click()

  //searching campaign
  let bySearchCampaign = By.id('gwt-debug-table-search-input');
  await driver.wait(until.elementLocated(bySearchCampaign, 30000));
  let inputSearchCampaign = driver.findElement(bySearchCampaign);
  await driver.wait(until.elementIsVisible(inputSearchCampaign), 30000);
  inputSearchCampaign.sendKeys(campaign, Key.RETURN)

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
    let byCreateCampaign = By.id('gwt-debug-new-campaign-campaignText');
    await driver.wait(until.elementLocated(byCreateCampaign, 30000));
    let inputCreateCampaign = driver.findElement(byCreateCampaign);
    await driver.wait(until.elementIsVisible(inputCreateCampaign), 30000);
    inputCreateCampaign.sendKeys(store.campaign)

    await driver.findElement(By.id('gwt-debug-save-button')).click()
  }
}

function isNeedToUpload(creativeFullName, updateOnly) {
  if (!updateOnly) return false
  const updateOnlySplitted = updateOnly.split(',')

  for (dimensions of updateOnlySplitted) {
    let isNeedToUploadBoolean = creativeFullName.includes(dimensions)

    if (isNeedToUploadBoolean) return true
  }

  return false
}

async function isCreaviseAlreadyCreated(creative) {
  //searching creative

  let bySearchCreative = By.id('gwt-debug-table-search-input');
  await driver.wait(until.elementLocated(bySearchCreative, 30000));
  let inputSearchCreative = driver.findElement(bySearchCreative);
  await driver.wait(until.elementIsVisible(inputSearchCreative), 30000);

  // if the input is disabled it means that there aren't any creatives here yet
  let isUnoutSearchDisabled = await driver.executeScript('let input = document.getElementById("gwt-debug-table-search-input").disabled; return input;')

  if (isUnoutSearchDisabled) return false

  inputSearchCreative.sendKeys(creative, Key.RETURN)

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

  await uploadFiles(creative.filesInString, creative.namesOfFilesArr, creative.pathsOfFilesArr, creative.creativeName, message, creative.numOfFiles, creative.folderSize)

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
  let bySelectAllFiles = By.id('gwt-debug-select-all-checkbox-input');
  await driver.wait(until.elementLocated(bySelectAllFiles, 30000));
  let checkboxSelectAllFiles = driver.findElement(bySelectAllFiles);
  await driver.wait(until.elementIsVisible(checkboxSelectAllFiles), 30000);
  checkboxSelectAllFiles.click()

  //click on delete files button
  let byDeleteFiles = By.id('gwt-debug-creativeworkflow-delete-button');
  await driver.wait(until.elementLocated(byDeleteFiles, 30000));
  let buttonDeleteFiles = driver.findElement(byDeleteFiles);
  await driver.wait(until.elementIsVisible(buttonDeleteFiles), 30000);
  buttonDeleteFiles.click()
}

async function uploadCreative(creative, message) {
  await createNewCreative(creative.creativeName, creative.creativeWidth, creative.creativeHeight)
  await uploadFiles(creative.filesInString, creative.namesOfFilesArr, creative.pathsOfFilesArr, creative.creativeName, message, creative.numOfFiles, creative.folderSize)
}

async function createNewCreative(creativeName, creativeWidth, creativeHeight) {
  //wait when the button "new creative" appears and click on it
  let byNewCretive = By.id('gwt-debug-new-creative-dropdown-new-creative-button');
  await driver.wait(until.elementLocated(byNewCretive, 30000));
  let buttonNewCretive = driver.findElement(byNewCretive);
  await driver.wait(until.elementIsVisible(buttonNewCretive), 30000);
  buttonNewCretive.click()

  //waiting for the button "Next" to appear. Hence this means that the entire page has loaded
  let byNewCreativeNext = By.id('gwt-debug-creativeworkflow-next-button');
  await driver.wait(until.elementLocated(byNewCreativeNext, 30000));
  let buttonNewCretiveNext = driver.findElement(byNewCreativeNext);
  await driver.wait(until.elementIsVisible(buttonNewCretiveNext), 30000);

  //check if the fields of some input are not still empty. Because AJAX is used
  while (true) {
    let checkInputsAreNotEmpty = await driver.executeScript('let inputAccountName = document.getElementById("gwt-debug-creativeDetail-accountText"); let inputAdvertiserName = document.getElementById("gwt-debug-creativeDetail-advertiserText"); let inputCampaignName = document.getElementById("gwt-debug-creativeDetail-campaignText"); return inputAccountName.value && inputAdvertiserName.value && inputCampaignName.value')

    if (checkInputsAreNotEmpty) break
  }

  //send keys in creative name input
  let byCreativeName = By.id('gwt-debug-creativeDetail-nameText');
  await driver.wait(until.elementLocated(byCreativeName, 30000));
  let inputCreativeName = driver.findElement(byCreativeName);
  await driver.wait(until.elementIsVisible(inputCreativeName), 30000);
  inputCreativeName.sendKeys(creativeName)

  //click on the "size button" 
  await driver.findElement(By.id('gwt-debug-creativeDetail-sizeText')).click()

  //choose user-defined dimensions option
  let byUserDefined = By.id('gwt-debug-creativeDetail-sizeText-CUSTOM');
  await driver.wait(until.elementLocated(byUserDefined, 30000));
  let optionUserDefined = driver.findElement(byUserDefined);
  await driver.wait(until.elementIsVisible(optionUserDefined), 30000);
  optionUserDefined.click()

  //send keys in creative width input
  let byCreativeWidth = By.id('gwt-debug-creativeDetail-widthText');
  await driver.wait(until.elementLocated(byCreativeWidth, 30000));
  let inputCreativeWidth = driver.findElement(byCreativeWidth);
  await driver.wait(until.elementIsVisible(inputCreativeWidth), 30000);
  inputCreativeWidth.sendKeys(creativeWidth)

  //send keys in creative height input
  let byCreativeHeight = By.id('gwt-debug-creativeDetail-heightText');
  await driver.wait(until.elementLocated(byCreativeHeight, 30000));
  let inputCreativeHeight = driver.findElement(byCreativeHeight);
  await driver.wait(until.elementIsVisible(inputCreativeHeight), 30000);
  await inputCreativeHeight.sendKeys(creativeHeight)

  await buttonNewCretiveNext.click()
}

async function uploadFiles(filesInString, namesOfFilesArr, pathsOfFilesArr, creativeName, message, numOfFiles, folderSize) {
  //waiting for the "drop zone" element
  let byDropZone = By.id('gwt-debug-creativeworkflow-drop-zone');
  await driver.wait(until.elementLocated(byDropZone, 30000));
  let elementDropZone = driver.findElement(byDropZone);
  await driver.wait(until.elementIsVisible(elementDropZone), 30000);

  //make visible input[type='file'] and upload files
  await driver.executeScript('document.querySelector("input[type=file]").style.height = "50px"; document.querySelector("input[type=file]").style.width = "50px"; document.querySelector("input[type=file]").style.display="block"; document.querySelector("input[type=file]").style.visibility="visible";  ')
  await driver.findElement(By.xpath("//input[@type='file']")).sendKeys(`${filesInString}`)

  //waiting for all files to load
  let byUploadComplete = By.xpath('//*[text()="Upload complete"]');
  await driver.wait(until.elementLocated(byUploadComplete, 120000));
  let elementUploadComplete = driver.findElement(byUploadComplete);
  await driver.wait(until.elementIsVisible(elementUploadComplete), 120000);

  await driver.sleep(2000)

  await checkAndReaploadFiledFiles(namesOfFilesArr, pathsOfFilesArr, creativeName, message, numOfFiles, folderSize)
  await driver.sleep(3000)
  await checkBackup()

  await driver.findElement(By.id('gwt-debug--breadcrumbs-link-2')).click()

  await driver.sleep(3000)
}
//TODO check if it work correctly with .zip
async function checkAndReaploadFiledFiles(namesOfFilesArr, pathsOfFilesArr, creativeName, message, numOfFiles, folderSize) {
  let strSrciptCheckFiledFiles = 'let parent = document.getElementById("gwt-debug-upload-panel-file-list"); let childsOfLastChildren = parent.getElementsByTagName("div")[1].children; let arr = [];for (let i = 0; i < childsOfLastChildren.length; i++) {let fileName = childsOfLastChildren[i].children[0].getAttribute("title");let uploadResult = childsOfLastChildren[i].children[1].children[1].innerHTML;if (uploadResult === "Failed") {arr.push(fileName)};}; return arr;'
  let resultArr = await driver.executeScript(strSrciptCheckFiledFiles)

  if (resultArr.length) {
    for (let i = 0; i < resultArr.length; i++) {
      let indexOfFiledFile = namesOfFilesArr.indexOf(resultArr[i])

      await driver.findElement(By.xpath("//input[@type='file']")).sendKeys(`${pathsOfFilesArr[indexOfFiledFile]}`)
      await driver.sleep(3000)

      let recheckArr = await driver.executeScript(strSrciptCheckFiledFiles)
      const recheckArrWithoutDuplicates = recheckArr.filter((it, index) => index === recheckArr.indexOf(it = it.trim()))

      if (recheckArr.length) console.log(`\n${chalk.red('Not fully loaded')} => ${creativeName}\n Error loading the following files => ${chalk.red(recheckArrWithoutDuplicates)}\n`)

    }
  } else {
    durationObj.endUploadCreativeTime = new Date().getTime()

    let uploadingDuration = getDuration(durationObj.startUploadCreativeTime, durationObj.endUploadCreativeTime)

    console.log(`\n${chalk.green(`Creative ${message} `)}${chalk.blue(`(Time: ${uploadingDuration}, Files: ${numOfFiles}, Size: ${folderSize})`)} => ${creativeName}\n`)
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