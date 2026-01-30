import * as fs from "fs";
import * as path from "path";
import { parseWorkoutEmail } from "./otf-email-parser";

/**
 * Decodes quoted-printable encoded content
 * - =XX becomes the character with hex code XX
 * - = at end of line (soft line break) is removed
 */
function decodeQuotedPrintable(str: string): string {
	return (
		str
			// Remove soft line breaks (= followed by newline)
			.replace(/=\r?\n/g, "")
			// Decode =XX hex sequences
			.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
				String.fromCharCode(parseInt(hex, 16))
			)
	);
}

/**
 * Extracts HTML content from an .eml file
 * .eml files have headers followed by the HTML body after a blank line
 * Handles quoted-printable encoding commonly used in emails
 */
function extractHtmlFromEml(emlContent: string): string {
	// Check if content is quoted-printable encoded
	const isQuotedPrintable = emlContent
		.toLowerCase()
		.includes("content-transfer-encoding: quoted-printable");

	// Find the start of the HTML content (case-insensitive)
	const htmlStartUpper = emlContent.indexOf("<!DOCTYPE");
	const htmlStartLower = emlContent.indexOf("<!doctype");
	const htmlStart =
		htmlStartUpper !== -1
			? htmlStartUpper
			: htmlStartLower !== -1
			? htmlStartLower
			: -1;

	let html: string;

	if (htmlStart !== -1) {
		html = emlContent.substring(htmlStart);
	} else {
		// Alternative: find after double newline (blank line separating headers from body)
		const bodyStart = emlContent.indexOf("\r\n\r\n");
		if (bodyStart !== -1) {
			html = emlContent.substring(bodyStart + 4);
		} else {
			const bodyStartUnix = emlContent.indexOf("\n\n");
			if (bodyStartUnix !== -1) {
				html = emlContent.substring(bodyStartUnix + 2);
			} else {
				html = emlContent;
			}
		}
	}

	// Decode quoted-printable if needed
	if (isQuotedPrintable) {
		html = decodeQuotedPrintable(html);
	}

	// Remove MIME boundary markers that might appear at the end
	const boundaryMatch = html.match(/\r?\n--[A-Za-z0-9]+--?\r?\n?$/);
	if (boundaryMatch) {
		html = html.substring(0, html.length - boundaryMatch[0].length);
	}

	return html;
}

/**
 * Loads an .eml file and returns the HTML content
 */
function loadEmlFile(filename: string): string {
	const emlPath = path.join(__dirname, filename);
	const emlContent = fs.readFileSync(emlPath, "utf-8");
	return extractHtmlFromEml(emlContent);
}

describe("OTF Email Parser", () => {
	describe("example.eml", () => {
		let parsedData: ReturnType<typeof parseWorkoutEmail>;

		beforeAll(() => {
			const html = loadEmlFile("example.eml");
			parsedData = parseWorkoutEmail(html);
		});

		describe("Class Metadata", () => {
			it("should parse class time", () => {
				expect(parsedData.classTime).toBe("10:45 AM");
			});

			it("should parse studio location", () => {
				expect(parsedData.studioLocation).toBe("New Albany, OH");
			});

			it("should parse class instructor", () => {
				expect(parsedData.classInstructor).toBe("Lamara Ambler");
			});
		});

		describe("Main Metrics", () => {
			it("should parse calories burned", () => {
				expect(parsedData.caloriesBurned).toBe(1007);
			});

			it("should parse splat points", () => {
				expect(parsedData.splatPoints).toBe(41);
			});

			it("should parse average heart rate", () => {
				expect(parsedData.avgHeartRate).toBe(167);
			});

			it("should parse peak heart rate", () => {
				expect(parsedData.peakHeartRate).toBe(186);
			});

			it("should parse steps", () => {
				expect(parsedData.steps).toBe(4080);
			});
		});

		describe("Treadmill Performance", () => {
			it("should parse treadmill distance", () => {
				expect(parsedData.treadmillDistance).toBe(2.08);
			});

			it("should parse treadmill time", () => {
				expect(parsedData.treadmillTime).toBe(1008); // 16:48 = 16*60 + 48 = 1008 seconds
			});

			it("should parse treadmill average speed", () => {
				expect(parsedData.treadmillAvgSpeed).toBe(7.4);
			});

			it("should parse treadmill max speed", () => {
				expect(parsedData.treadmillMaxSpeed).toBe(10);
			});

			it("should parse treadmill average incline", () => {
				expect(parsedData.treadmillAvgIncline).toBe(1);
			});

			it("should parse treadmill max incline", () => {
				expect(parsedData.treadmillMaxIncline).toBe(1);
			});

			it("should parse treadmill average pace", () => {
				expect(parsedData.treadmillAvgPace).toBe(486); // 8:06 = 8*60 + 6 = 486 seconds
			});

			it("should parse treadmill fastest pace", () => {
				expect(parsedData.treadmillFastestPace).toBe(360); // 6:00 = 6*60 = 360 seconds
			});

			it("should parse treadmill elevation", () => {
				expect(parsedData.treadmillElevation).toBe(109.82);
			});
		});

		describe("Rower Performance", () => {
			it("should parse rowing distance", () => {
				expect(parsedData.rowingDistance).toBe(4038);
			});

			it("should parse rowing time", () => {
				expect(parsedData.rowingTime).toBe(1047); // 17:27 = 17*60 + 27 = 1047 seconds
			});

			it("should parse rowing average wattage", () => {
				expect(parsedData.rowingAvgWattage).toBe(244);
			});

			it("should parse rowing max wattage", () => {
				expect(parsedData.rowingMaxWattage).toBe(491);
			});

			it("should parse rowing average speed", () => {
				expect(parsedData.rowingAvgSpeed).toBe(17.7);
			});

			it("should parse rowing max speed", () => {
				expect(parsedData.rowingMaxSpeed).toBe(22.3);
			});

			it("should parse rowing 500m split", () => {
				expect(parsedData.rowing500mSplit).toBe(102); // 1:42 = 1*60 + 42 = 102 seconds
			});

			it("should parse rowing max 500m split", () => {
				expect(parsedData.rowingMax500mSplit).toBe(102); // 1:42 = 102 seconds
			});

			it("should parse rowing average stroke rate", () => {
				expect(parsedData.rowingAvgStrokeRate).toBe(26.3);
			});
		});

		describe("Zone Minutes", () => {
			it("should parse active minutes", () => {
				expect(parsedData.activeMinutes).toBe(57);
			});

			it("should parse gray zone minutes", () => {
				expect(parsedData.minutesInGrayZone).toBe(0);
			});

			it("should parse blue zone minutes", () => {
				expect(parsedData.minutesInBlueZone).toBe(1);
			});

			it("should parse green zone minutes", () => {
				expect(parsedData.minutesInGreenZone).toBe(15);
			});

			it("should parse orange zone minutes", () => {
				expect(parsedData.minutesInOrangeZone).toBe(38);
			});

			it("should parse red zone minutes", () => {
				expect(parsedData.minutesInRedZone).toBe(3);
			});
		});
	});
});

/**
 * Helper type for expected workout values
 */
interface ExpectedWorkoutData {
	classTime?: string | null;
	studioLocation?: string | null;
	classInstructor?: string | null;
	caloriesBurned?: number | null;
	splatPoints?: number | null;
	avgHeartRate?: number | null;
	peakHeartRate?: number | null;
	steps?: number | null;
	treadmillDistance?: number | null;
	treadmillTime?: number | null;
	treadmillAvgSpeed?: number | null;
	treadmillMaxSpeed?: number | null;
	treadmillAvgIncline?: number | null;
	treadmillMaxIncline?: number | null;
	treadmillAvgPace?: number | null;
	treadmillFastestPace?: number | null;
	treadmillElevation?: number | null;
	rowingDistance?: number | null;
	rowingTime?: number | null;
	rowingAvgWattage?: number | null;
	rowingMaxWattage?: number | null;
	rowingAvgSpeed?: number | null;
	rowingMaxSpeed?: number | null;
	rowing500mSplit?: number | null;
	rowingMax500mSplit?: number | null;
	rowingAvgStrokeRate?: number | null;
	activeMinutes?: number | null;
	minutesInGrayZone?: number | null;
	minutesInBlueZone?: number | null;
	minutesInGreenZone?: number | null;
	minutesInOrangeZone?: number | null;
	minutesInRedZone?: number | null;
}

/**
 * Test helper to add new email test cases easily
 * Usage:
 *   testEmailFile("workout2.eml", {
 *     classTime: "9:00 AM",
 *     studioLocation: "Columbus, OH",
 *     caloriesBurned: 850,
 *     // ... other expected values
 *   });
 */
export function testEmailFile(filename: string, expected: ExpectedWorkoutData) {
	describe(filename, () => {
		let parsedData: ReturnType<typeof parseWorkoutEmail>;

		beforeAll(() => {
			const html = loadEmlFile(filename);
			parsedData = parseWorkoutEmail(html);
		});

		Object.entries(expected).forEach(([key, value]) => {
			it(`should parse ${key}`, () => {
				expect(parsedData[key as keyof typeof parsedData]).toBe(value);
			});
		});
	});
}

testEmailFile(
	"example2.eml",

	{
		classTime: "4:15:00 PM",
		studioLocation: "Rookwood",
		classInstructor: "Brennan",
		caloriesBurned: 952,
		splatPoints: 37,
		avgHeartRate: 162,
		peakHeartRate: 193,
		steps: 3283,
		treadmillDistance: 1.77,
		treadmillTime: 801,
		treadmillAvgSpeed: 7.9,
		treadmillMaxSpeed: 11,
		treadmillAvgIncline: 0,
		treadmillMaxIncline: 0,
		treadmillAvgPace: 457,
		treadmillFastestPace: 327,
		treadmillElevation: 0,
		rowingDistance: null,
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
	}
);

// testEmailFile(
// 	"example3.eml",

// 	{
// 		classTime: "10:45 AM",
// 		studioLocation: "New Albany, OH",
// 		classInstructor: "Shannon",
// 		caloriesBurned: 988,
// 		splatPoints: 37,
// 		avgHeartRate: 166,
// 		peakHeartRate: 186,
// 		steps: 4960,
// 		treadmillDistance: 3.53,
// 		treadmillTime: 0,
// 		treadmillAvgSpeed: 7.1,
// 		treadmillMaxSpeed: 10.3,
// 		treadmillAvgIncline: 1,
// 		treadmillMaxIncline: 4,
// 		treadmillAvgPace: 504,
// 		treadmillFastestPace: 349,
// 		treadmillElevation: 189.18,
// 		rowingDistance: 1913,
// 		rowingTime: 673,
// 		rowingAvgWattage: 1,
// 		rowingMaxWattage: 473,
// 		rowingAvgSpeed: 17.7,
// 		rowingMaxSpeed: 20.6,
// 		rowing500mSplit: 105,
// 		rowingMax500mSplit: 87,
// 		rowingAvgStrokeRate: 25.7,
// 		activeMinutes: 58,
// 		minutesInGrayZone: 1,
// 		minutesInBlueZone: 3,
// 		minutesInGreenZone: 17,
// 		minutesInOrangeZone: 30,
// 		minutesInRedZone: 7,
// 	}
// );

// testEmailFile("example4.eml", {
// 	classTime: "4:15:00 PM",
// 	studioLocation: "West Chester",
// 	classInstructor: "Melissa",
// 	caloriesBurned: 833,
// 	splatPoints: 28,
// 	avgHeartRate: 147,
// 	peakHeartRate: 181,
// 	steps: 3261,
// 	treadmillDistance: 1.86,
// 	treadmillTime: 1043,
// 	treadmillAvgSpeed: 6.4,
// 	treadmillMaxSpeed: 12,
// 	treadmillAvgIncline: 1,
// 	treadmillMaxIncline: 1,
// 	treadmillAvgPace: 563,
// 	treadmillFastestPace: 300,
// 	treadmillElevation: 97.85,
// 	rowingDistance: null,
// 	rowingTime: null,
// 	rowingAvgWattage: null,
// 	rowingMaxWattage: null,
// 	rowingAvgSpeed: null,
// 	rowingMaxSpeed: null,
// 	rowing500mSplit: null,
// 	rowingMax500mSplit: null,
// 	rowingAvgStrokeRate: null,
// 	activeMinutes: 58,
// 	minutesInGrayZone: 6,
// 	minutesInBlueZone: 9,
// 	minutesInGreenZone: 15,
// 	minutesInOrangeZone: 18,
// 	minutesInRedZone: 10,
// });
