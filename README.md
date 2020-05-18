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

Open the project in your IDE. Open the **index.js** file that is located in the **src** folder.
Write to the variables ```const myEmail = 'email'``` and ```const my Password = 'password'``` your email and password and safe this file.

## How it works

This program opens a new Google Chrome window and uploads or updates creatives in the Studio. Please **do not close or minimize** the Google Chrome window, otherwise the program will cause an error.

You must have a strict folder structure on your machine. The program reads the names of the folders and working with them. Therefore, it is very important to have similar names for the advertiser, campaign, and creatives.

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
