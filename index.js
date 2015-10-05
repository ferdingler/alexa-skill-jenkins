var http = require('http');
var config = require('./config.json');

var treeParams = '/api/json?pretty=true&tree=jobs[name,lastBuild[number,timestamp,result,changeSet[items[author[fullName]]]]]';
var jenkinsUrl = config.jenkinsUrl;
var username = config.jenkinsUser;
var apiKey = config.jenkinsApiToken;
var jobName = config.jenkinsJobName;
var jenkinsPort = config.jenkinsPort;

exports.handler = function (event, context) {
    
    console.log("event.session.application.applicationId=" + event.session.application.applicationId);

    try {
        if(event.request.type === "IntentRequest") {
            onIntent(event.request, event.session, function callback(sessionAttributes, speechletResponse) {
                context.succeed(buildResponse(sessionAttributes, speechletResponse));
            });
        }
    } catch (e) {
        context.fail("Exception: " + e);
    }
};

function onIntent(intentRequest, session, callback){
    console.log("onIntent requestId=" + intentRequest.requestId + ", sessionId=" + session.sessionId);
    if ("WhoBrokeTheBuild" === intentRequest.intent.name) {        
        whoBrokeTheBuild(intentRequest.intent, session, callback);
    }
}

function whoBrokeTheBuild(intent, session, callback){

    console.log("On whoBrokeTheBuild");

    var req = http.get({
        host: jenkinsUrl,
        port: jenkinsPort,
        path: treeParams,
        auth: username + ':' + apiKey
    }, function(res) {

        console.log("Returned response from jenkins");

        var jenkinsJson = '';
        var cardTitle = intent.name;
        var repromptText = "";
        var sessionAttributes = {};
        var shouldEndSession = true;
        var speechOutput = "";
        
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
            jenkinsJson += chunk;
        });

        res.on('end', function() {
            
            jenkinsJson = JSON.parse(jenkinsJson);
            var desiredJob = getDesiredJob(jenkinsJson);

            if(desiredJob === null){
                speechOutput = "I wasn't able to find a job named " + jobName;
                return callback(sessionAttributes, buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
            }

            var lastBuild = desiredJob.lastBuild;
            if(lastBuild.result === 'FAILURE'){
                var author = getAuthorFromLastBuild(desiredJob.lastBuild);
                speechOutput = author + " broke the build";
            } else {
                speechOutput = "The build is not broken";
            }

            return callback(sessionAttributes, buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));

        });
    });

    req.on('error', function(){
        throw "Failed to contact jenkins";
    });

    req.end();
}

function getDesiredJob(jenkinsJson){
    var jobs = jenkinsJson['jobs'];
    var desiredJob = null;
    jobs.forEach(function(job){
        if(job.name === jobName){
            desiredJob = job;
            return;
        }
    });
    return desiredJob;
}

function getAuthorFromLastBuild(lastBuild){
    var changeSetItems = lastBuild.changeSet.items;
    if(changeSetItems.length > 0){
        var author = changeSetItems[0].author;
        return author.fullName;
    }
    return null;
}

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        card: {
            type: "Simple",
            title: "SessionSpeechlet - " + title,
            content: "SessionSpeechlet - " + output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    }
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    }
}