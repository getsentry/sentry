const csv = require("csv-parser");
const fs = require("fs");

const transformResults = (res) => {
  const deviceMapping = {};
  res.map(({ name, model }) => {
    if (name && model) {
      deviceMapping[model] = name;
    }
  });
  return deviceMapping;
};
const results = [];
fs.createReadStream("supported_devices.csv")
  .pipe(csv())
  .on("data", (data) => results.push(data))
  .on("end", () => {
    fs.writeFileSync("devices.json", JSON.stringify(transformResults(results)));
  });
