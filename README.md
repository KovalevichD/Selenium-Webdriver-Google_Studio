# Automatically upload creatives to the Studio

## About

This tool lets you upload or update creatives in the Studio automatically.

## Install

Clone repo using command below
```sh
git clone https://github.com/KovalevichD/Selenium-Webdriver-Google_Studio.git uploadToStudio
```

Install dependencies
```sh
 cd uploadToStudio
 npm i
```

Install tool as global npm package(enter your password)
```sh
sudo npm i -g .
```

## How it works

This program opens the HTML file of your creative in the Google Chrome, waiting for the specified amount of time and make the screenshot. The program make screenshot by selector **#wrapper** so please make sure your creative **wrapped by tag** ```<div id="wrapper"></div>```. Also the name of the backup image will be taken from the name of the folder in which the creative is located (example: /666x999/... => backup_666x999.jpg). Size of the image doesn't exceed 40KB. 

## Usage

Open the folder with the creative files for which you want to make backup image. Open Terminal in this folder.

Run the command 
```bash
shot 8 
```
*8 - number of seconds after which it will be made the backup image (default 10 seconds waiting)*

After executing this line just wait a few seconds - the backup image (example: "backup_300x600") of your creative will be created. Also you can see some information about the image in Terminal after executing.