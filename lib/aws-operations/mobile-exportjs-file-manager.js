/* 
 * Copyright 2017-2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with
 * the License. A copy of the License is located at
 *
 *     http://aws.amazon.com/apache2.0/
 *
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions
 * and limitations under the License.
*/
"use strict";
const fs = require('fs-extra')
const chalk = require('chalk')
const ora = require('ora')
const https = require('https')
const extract = require('extract-zip')

const awsClient = require('./aws-client.js')
const awsExceptionHandler = require('./aws-exception-handler.js')
const awsmobilejsConstant = require('../utils/awsmobilejs-constant.js')
const dfops = require('../utils/directory-file-ops.js')
const pathManager = require('../utils/awsmobilejs-path-manager.js')

let _projectInfo

function getAWSExportFile(projectInfo, awsDetails, callback){
    _projectInfo = projectInfo
    if(projectInfo.BackendProjectID && projectInfo.BackendProjectID.length > 0){
        retrieveAWSConfigurationFile(projectInfo, awsDetails, callback)
    }
}

function onClearBackend(projectInfo){
    _projectInfo = projectInfo
    removeLocalAWSExportFiles(projectInfo)
}

function onProjectConfigChange(projectInfo_old, projectInfo){
    if(projectInfo_old.SourceDir != projectInfo.SourceDir){
        let configurationFileName = getConfigurationFileName(projectInfo_old)
        let srcDirExportFilePath_old = pathManager.getSrcDirExportFilePath(projectInfo_old, configurationFileName)
        if(srcDirExportFilePath_old && fs.existsSync(srcDirExportFilePath_old)){
            fs.removeSync(srcDirExportFilePath_old)
        }
        let awsExportFilePath = pathManager.getAWSExportFilePath(projectInfo.ProjectPath, configurationFileName) 
        if(awsExportFilePath && fs.existsSync(awsExportFilePath)){
            let srcDir = pathManager.getSrcDirPath(projectInfo)
            if(srcDir && fs.existsSync(srcDir)){
                let srcDirExportFilePath = pathManager.getSrcDirExportFilePath(projectInfo, configurationFileName)

                fs.copySync(awsExportFilePath, srcDirExportFilePath)
                console.log()
                console.log('aws-exports.js file is copied into your project\'s source directory')
                console.log(chalk.blue(srcDirExportFilePath))
            }
        }
    }
}

function retrieveAWSConfigurationFile(projectInfo, awsDetails, callback)
{
    let spinner = ora('retrieving aws-exports.js')
    spinner.start()

    let mobile = awsClient.Mobile(awsDetails)

    let exportBundleParams = { 
        bundleId: 'app-config',
        projectId: _projectInfo.BackendProjectID,
        platform: getPlatform(projectInfo)
    }
    mobile.exportBundle(exportBundleParams, function (err, data) {
        spinner.stop()
        if(err){
            awsExceptionHandler.handleMobileException(err)
        }else if(data && data.downloadUrl){
            downloadAWSConfigurationFile(projectInfo, data.downloadUrl, callback)
        }
    })
}

function getPlatform(projectInfo){
    //"OSX"|"WINDOWS"|"LINUX"|"OBJC"|"SWIFT"|"ANDROID"|"JAVASCRIPT"|string;
    let platform = 'JAVASCRIPT'
    if(projectInfo.Framework && projectInfo.Framework.length > 0){
        switch(projectInfo.Framework){
            case "objective-c" : 
                platform = 'OBJC'
            break
            case "swift" : 
                platform = 'SWIFT'
            break
            case "android" : 
                platform = 'ANDROID'
            break
        }
    }
    return platform
}

function getConfigurationFileName(projectInfo){
    let fileName = awsmobilejsConstant.AWSExportFileName
    if(projectInfo.Framework && projectInfo.Framework.length > 0){
        switch(projectInfo.Framework){
            case "objective-c" : 
                fileName = awsmobilejsConstant.AWSConfigurationFileName
            break
            case "swift" : 
                fileName = awsmobilejsConstant.AWSConfigurationFileName
            break
            case "android" : 
                fileName = awsmobilejsConstant.AWSConfigurationFileName
            break
        }
    }
    return fileName
}

function downloadAWSConfigurationFile(projectInfo, downloadUrl, callback) { 
    let tempExtractDirPath = pathManager.getAWSExportExtractTempDirPath(_projectInfo.ProjectPath)
    let tempZipFilePath = pathManager.getAWSExportTempZipFilePath(_projectInfo.ProjectPath)
    let tempZipFile = fs.createWriteStream(tempZipFilePath)
    let request = https.get(downloadUrl, function(response) {
        response.pipe(tempZipFile)
        .on('close',()=>{
            extract(tempZipFilePath, {dir: tempExtractDirPath}, function (err) {
                if(err){
                    console.log(err)
                }else{
                    let configurationFileName = getConfigurationFileName(projectInfo)
                    let tempExportFilePath = dfops.findFile(tempExtractDirPath, configurationFileName)
                  
                    if(tempExportFilePath){
                        updateCurrentAWSExportFiles(tempExportFilePath, configurationFileName)
                        fs.removeSync(tempExtractDirPath) 
                        fs.removeSync(tempZipFilePath)
                        if(callback){
                            callback(configurationFileName)
                        }
                    }

                }
            })
        })
    })
}

function updateCurrentAWSExportFiles(sourceFilePath, configurationFileName){ 
    let awsExportFilePath = pathManager.getAWSExportFilePath(_projectInfo.ProjectPath, configurationFileName) 
    if(awsExportFilePath){
        fs.copySync(sourceFilePath, awsExportFilePath)
        console.log('awsmobile project\'s access information logged at: ')
        console.log('    ' + chalk.blue(pathManager.getAWSExportFilePath_relative(_projectInfo.ProjectPath, configurationFileName) ))    
    }
}
 
function removeLocalAWSExportFiles(projectInfo){ 
    let configurationFileName = getConfigurationFileName(projectInfo)
    let awsExportFilePath = pathManager.getAWSExportFilePath(_projectInfo.ProjectPath, configurationFileName) 
    if(fs.existsSync(awsExportFilePath)){
        fs.removeSync(awsExportFilePath)
    }

    let srcDir = pathManager.getSrcDirPath(_projectInfo)
    if(srcDir && fs.existsSync(srcDir)){
        let srcDirExportFilePath = pathManager.getSrcDirExportFilePath(_projectInfo, configurationFileName)
        if(srcDirExportFilePath && fs.existsSync(srcDirExportFilePath)){
            fs.removeSync(srcDirExportFilePath)
        }
    }
}

module.exports = {
    getAWSExportFile,
    onClearBackend,
    onProjectConfigChange
}

