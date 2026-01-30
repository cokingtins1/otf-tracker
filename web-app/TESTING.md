# Testing the OTF Email Parser

This document explains how to run and extend the unit tests for the OTF email parser.

## Running Tests

### Run all tests

```bash
npm test
```

### Run tests in watch mode

This will re-run tests automatically when files change:

```bash
npm run test:watch
```

### Run a specific test file

```bash
npx jest lib/parsers/otf-email-parser.test.ts
```

### Run only a specific .eml test

```bash
npx jest -t "example2.eml"
```

The `-t` flag filters by test name, so it runs only the describe block matching that name.

## Adding a New Email Test Case

### Step 1: Place the .eml file

Save your `.eml` file in the `lib/parsers/` folder:

```
lib/parsers/my-workout.eml
```

### Step 2: Add the test at the bottom of the test file

Open `lib/parsers/otf-email-parser.test.ts` and add at the bottom:

```typescript
testEmailFile("my-workout.eml", {
  classTime: "4:15 PM",           // Format: "H:MM AM/PM" (no seconds)
  studioLocation: "New Albany, OH", // Usually "City, ST" format
  classInstructor: "John Smith",
  caloriesBurned: 850,
  splatPoints: 35,
  avgHeartRate: 155,
  peakHeartRate: 178,
  steps: 3500,
  treadmillDistance: 1.85,
  treadmillTime: 900,             // Seconds (15:00 = 900)
  treadmillAvgSpeed: 7.2,
  treadmillMaxSpeed: 9.5,
  treadmillAvgIncline: 1,
  treadmillMaxIncline: 2,
  treadmillAvgPace: 480,          // Seconds per mile (8:00 = 480)
  treadmillFastestPace: 360,      // Seconds per mile (6:00 = 360)
  treadmillElevation: 109.82,
  rowingDistance: null,           // Use null if no rower data
  rowingTime: null,
  rowingAvgWattage: null,
  rowingMaxWattage: null,
  rowingAvgSpeed: null,
  rowingMaxSpeed: null,
  rowing500mSplit: null,
  rowingMax500mSplit: null,
  rowingAvgStrokeRate: null,
  activeMinutes: 58,
  minutesInGrayZone: 2,
  minutesInBlueZone: 4,
  minutesInGreenZone: 15,
  minutesInOrangeZone: 19,
  minutesInRedZone: 18,
});
```

### Step 3: Run the test

```bash
npx jest -t "my-workout.eml"
```

## Debugging Failed Tests

If tests fail, the parser may be returning different values than expected. To see what the parser actually extracts:

### Option 1: Create a quick debug script

Create `test-debug.js` in the project root:

```javascript
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const { parseWorkoutEmail } = require("./lib/parsers/otf-email-parser");

// Load and parse the email
const emlPath = path.join(__dirname, "lib/parsers/example2.eml");
const emlContent = fs.readFileSync(emlPath, "utf-8");
const htmlStart = emlContent.indexOf("<!DOCTYPE");
const html = emlContent.substring(htmlStart);

const result = parseWorkoutEmail(html);
console.log(JSON.stringify(result, null, 2));
```

Run with:
```bash
npx ts-node test-debug.js
```

Or if using plain JS imports don't work, use:
```bash
node -e "
const fs = require('fs');
const emlContent = fs.readFileSync('lib/parsers/example2.eml', 'utf-8');
const htmlStart = emlContent.indexOf('<!DOCTYPE');
const html = emlContent.substring(htmlStart);
// Then examine the HTML to see what format the data is in
console.log(html.substring(0, 2000));
"
```

### Option 2: Check the actual vs expected in test output

When a test fails, Jest shows:
```
Expected: "4:15 PM"
Received: null
```

This tells you what the parser returned vs what you expected.

## Common Format Issues

| Field | Correct Format | Wrong Format |
|-------|---------------|--------------|
| `classTime` | `"4:15 PM"` | `"4:15:00 PM"`, `"16:15"` |
| `studioLocation` | `"New Albany, OH"` | `"New Albany"` (missing state) |
| `treadmillTime` | `900` (seconds) | `"15:00"` (string) |
| `treadmillAvgPace` | `480` (sec/mile) | `"8:00"` (string) |

## Expected Data Fields

All fields that can be parsed:

| Field | Type | Description |
|-------|------|-------------|
| `classTime` | string | Class time (e.g., "10:45 AM") |
| `studioLocation` | string | Studio location (e.g., "New Albany, OH") |
| `classInstructor` | string | Instructor name |
| `caloriesBurned` | number | Total calories |
| `splatPoints` | number | Splat points earned |
| `avgHeartRate` | number | Average heart rate (bpm) |
| `peakHeartRate` | number | Peak heart rate (bpm) |
| `steps` | number | Total steps |
| `treadmillDistance` | number | Distance in miles |
| `treadmillTime` | number | Time in seconds |
| `treadmillAvgSpeed` | number | Avg speed (mph) |
| `treadmillMaxSpeed` | number | Max speed (mph) |
| `treadmillAvgIncline` | number | Avg incline (%) |
| `treadmillMaxIncline` | number | Max incline (%) |
| `treadmillAvgPace` | number | Avg pace (seconds/mile) |
| `treadmillFastestPace` | number | Fastest pace (seconds/mile) |
| `treadmillElevation` | number | Elevation (feet) |
| `rowingDistance` | number | Distance in meters |
| `rowingTime` | number | Time in seconds |
| `rowingAvgWattage` | number | Avg watts |
| `rowingMaxWattage` | number | Max watts |
| `rowingAvgSpeed` | number | Avg speed (km/h) |
| `rowingMaxSpeed` | number | Max speed (km/h) |
| `rowing500mSplit` | number | 500m split (seconds) |
| `rowingMax500mSplit` | number | Best 500m split (seconds) |
| `rowingAvgStrokeRate` | number | Avg strokes/min |
| `activeMinutes` | number | Total active minutes |
| `minutesInGrayZone` | number | Minutes in gray (zone 1) |
| `minutesInBlueZone` | number | Minutes in blue (zone 2) |
| `minutesInGreenZone` | number | Minutes in green (zone 3) |
| `minutesInOrangeZone` | number | Minutes in orange (zone 4) |
| `minutesInRedZone` | number | Minutes in red (zone 5) |

## Time Conversions

Time values are stored in seconds:

- `16:48` (MM:SS) = 16 × 60 + 48 = **1008 seconds**
- `8:06` (pace) = 8 × 60 + 6 = **486 seconds per mile**
- `6:00` = 6 × 60 = **360 seconds**
- `1:42` = 1 × 60 + 42 = **102 seconds**
