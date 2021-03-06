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
```sh
npm run-script createSettings
```

## How it works

This program opens a new Google Chrome window and uploads or updates creatives in the Studio. Please **do not close or minimize** the Google Chrome window, otherwise the program will cause an error.

You must have a strict folder structure on your machine. The program reads the names of the folders and working with them. Therefore, it is very important to have similar names for the advertiser, campaign, and creatives. E.G. **DELVE - UNICEF/Sequenced Stories/DELVE|UNICEF|SequencedStories|Sequence3|Uuriintsolmon|970x250**

It is assumed that the advertiser has already been created in the Studio.

## Usage

Open the folder with creatives files which you want to upload ao update. Open Terminal in this folder.

Run the command 
```bash
upload
```

Now you can see that Google Chrome opens and the program is running. The program searches for the advertiser and then the campaign. If there is no such company in the Studio, then creates a new one, if there is, then loads it to the existing one. Then all creatives from the folder are loaded.

If you want to upload one or more creatives instead of all of them, write the dimensions separated by commas
```bash
upload 320x50,300x600
```
As the program runs, you can find out which creatives have already been uploaded or updated in the terminal.