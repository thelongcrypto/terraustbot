const { initializeApp, applicationDefault, cert } = require('firebase-admin/app')

const {
  getFirestore,
  //   Timestamp,
  //   FieldValue,
} = require('firebase-admin/firestore')

let credential = applicationDefault()
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  credential = cert(require(process.env.GOOGLE_APPLICATION_CREDENTIALS))
}

var admin = require('firebase-admin')
var fs = require('fs')

initializeApp({
  //credential: cert(serviceAccount),
  //   credential: applicationDefault(),
  credential: credential,
})

var db = getFirestore()

// action = import | export
var action = process.argv[2]

if (action === 'export') {
  var collectionName = process.argv[3]

  var data = {}
  data[collectionName] = {}

  var results = db
    .collection(collectionName)
    .get()
    .then((snapshot) => {
      snapshot.forEach((doc) => {
        data[collectionName][doc.id] = doc.data()
      })
      return data
    })
    .catch((error) => {
      console.log(error)
    })

  results.then((dt) => {
    // Write collection to JSON file
    fs.writeFile('firestore-export.json', JSON.stringify(dt), function (err) {
      if (err) {
        return console.log(err)
      }
      console.log('The file was saved!')
    })
  })
} else if (action === 'import') {
  var fileName = process.argv[3]

  var collectionName = ''

  fs.readFile(fileName, 'utf8', function (err, data) {
    if (err) {
      return console.log(err)
    }

    // Turn string from file to an Array
    dataArray = JSON.parse(data)

    for (var index in dataArray) {
      collectionName = index
      for (var doc in dataArray[index]) {
        if (dataArray[index].hasOwnProperty(doc)) {
          db.collection(collectionName)
            .doc(doc)
            .set(dataArray[index][doc])
            .then(() => {
              console.log('Document is successed adding to firestore!')
            })
            .catch((error) => {
              console.log(error)
            })
        }
      }
    }
  })
}
