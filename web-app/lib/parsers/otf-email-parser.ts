import * as cheerio from "cheerio";

interface WorkoutData {
	// Class metadata
	classTime: string | null;
	studioLocation: string | null;
	classInstructor: string | null;

	// Main metrics
	caloriesBurned: number | null;
	splatPoints: number | null;
	avgHeartRate: number | null;
	peakHeartRate: number | null;
	steps: number | null;

	// Treadmill data
	treadmillDistance: number | null;
	treadmillTime: number | null; // seconds
	treadmillAvgSpeed: number | null; // mph
	treadmillMaxSpeed: number | null; // mph
	treadmillAvgIncline: number | null; // percent
	treadmillMaxIncline: number | null; // percent
	treadmillAvgPace: number | null; // seconds per mile
	treadmillFastestPace: number | null; // seconds per mile
	treadmillElevation: number | null; // feet

	// Rowing data
	rowingDistance: number | null;
	rowingTime: number | null; // seconds
	rowingAvgWattage: number | null; // watts
	rowingMaxWattage: number | null; // watts
	rowingAvgSpeed: number | null; // km/h
	rowingMaxSpeed: number | null; // km/h
	rowing500mSplit: number | null; // seconds
	rowingMax500mSplit: number | null; // seconds (fastest/best)
	rowingAvgStrokeRate: number | null; // strokes per minute

	// Zone minutes
	activeMinutes: number | null;
	minutesInGrayZone: number | null;
	minutesInBlueZone: number | null;
	minutesInGreenZone: number | null;
	minutesInOrangeZone: number | null;
	minutesInRedZone: number | null;
}

// Convert MM:SS or M:SS format to total seconds
function timeToSeconds(timeStr: string): number | null {
	const cleaned = timeStr.replace(/\u200c/g, "").replace(/&zwnj;/g, "").trim();
	const match = cleaned.match(/^(\d+):(\d{2})$/);
	if (!match) return null;
	const minutes = parseInt(match[1]);
	const seconds = parseInt(match[2]);
	if (isNaN(minutes) || isNaN(seconds)) return null;
	return minutes * 60 + seconds;
}

export function parseWorkoutEmail(html: string): WorkoutData {
	const $ = cheerio.load(html);

	const data: WorkoutData = {
		// Class metadata
		classTime: null,
		studioLocation: null,
		classInstructor: null,

		// Main metrics
		caloriesBurned: null,
		splatPoints: null,
		avgHeartRate: null,
		peakHeartRate: null,
		steps: null,

		// Treadmill data
		treadmillDistance: null,
		treadmillTime: null,
		treadmillAvgSpeed: null,
		treadmillMaxSpeed: null,
		treadmillAvgIncline: null,
		treadmillMaxIncline: null,
		treadmillAvgPace: null,
		treadmillFastestPace: null,
		treadmillElevation: null,

		// Rowing data
		rowingDistance: null,
		rowingTime: null,
		rowingAvgWattage: null,
		rowingMaxWattage: null,
		rowingAvgSpeed: null,
		rowingMaxSpeed: null,
		rowing500mSplit: null,
		rowingMax500mSplit: null,
		rowingAvgStrokeRate: null,

		// Zone minutes
		activeMinutes: null,
		minutesInGrayZone: null,
		minutesInBlueZone: null,
		minutesInGreenZone: null,
		minutesInOrangeZone: null,
		minutesInRedZone: null,
	};

	// Parse class metadata from header section
	// Studio location - found in header-studio-name class
	$("p.header-studio-name").each((_, el) => {
		if (!data.studioLocation) {
			const text = $(el).text().trim();
			if (text) data.studioLocation = text;
		}
	});

	// Alternative: look for studio name in the text near "STUDIO WORKOUT SUMMARY"
	if (!data.studioLocation) {
		$("p.text-white").each((_, el) => {
			const text = $(el).text().trim();
			// Skip the "STUDIO WORKOUT SUMMARY" text itself
			if (text && !text.includes("STUDIO WORKOUT SUMMARY") && text.includes(",")) {
				// Studio locations typically have format "City, ST"
				if (!data.studioLocation) data.studioLocation = text;
			}
		});
	}

	// Class time and instructor - found in the header table cells
	// Format in email: date | time | instructor name
	$("table").each((_, table) => {
		const tableHtml = $(table).html() || "";
		if (tableHtml.includes("STUDIO WORKOUT SUMMARY")) {
			$(table)
				.find("p.text-white")
				.each((_, el) => {
					const $el = $(el);
					const text = $el
						.text()
						.replace(/\u200c/g, "")
						.trim();

					// Skip elements with header-studio-name class (that's the studio location)
					const classes = $el.attr("class") || "";
					if (classes.includes("header-studio-name")) {
						return;
					}

					// Time format: matches "10:45 AM" or "10:45 PM"
					const timeMatch = text.match(/^(\d{1,2}:\d{2}\s*[AP]M)\s*$/i);
					if (timeMatch && !data.classTime) {
						data.classTime = timeMatch[1].trim();
					}
					// Date format: MM/DD/YYYY - skip these
					else if (text.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
						// Skip date entries
					}
					// Instructor: a name (single or multiple words), not containing : or numbers
					// Must be alphabetic characters (and spaces), at least 2 chars long
					else if (
						!data.classInstructor &&
						text &&
						text.length >= 2 &&
						!text.includes(":") &&
						!text.match(/^\d/) &&
						!text.includes("STUDIO") &&
						!text.includes(",") &&
						text.match(/^[A-Za-z\s]+$/)
					) {
						data.classInstructor = text;
					}
				});
		}
	});

	// Parse main metrics (calories, splat points, avg heart rate, steps)
	// The structure is: value in one <tr>, label in the next <tr>
	// So we need to find the label, go to parent td -> parent tr -> previous tr -> find value
	$("p.h2.text-gray").each((_, el) => {
		const labelText = $(el).text().trim();

		// Helper to get value from previous row
		const getValueFromPrevRow = (element: cheerio.Cheerio<cheerio.Element>): number | null => {
			const parentTr = element.closest("tr");
			if (!parentTr.length) return null;

			const prevTr = parentTr.prev("tr");
			if (!prevTr.length) return null;

			const valueEl = prevTr.find("p.h1.text-gray.text-bold");
			if (!valueEl.length) return null;

			const value = parseInt(valueEl.text().trim().replace(/,/g, ""));
			return isNaN(value) ? null : value;
		};

		if (labelText === "CALORIES BURNED" && !data.caloriesBurned) {
			const value = getValueFromPrevRow($(el));
			if (value !== null) data.caloriesBurned = value;
		}

		if (labelText === "SPLAT POINTS" && !data.splatPoints) {
			const value = getValueFromPrevRow($(el));
			if (value !== null) data.splatPoints = value;
		}

		if (labelText === "AVG. HEART-RATE" && !data.avgHeartRate) {
			const value = getValueFromPrevRow($(el));
			if (value !== null) data.avgHeartRate = value;
		}

		if (labelText === "STEPS" && !data.steps) {
			const value = getValueFromPrevRow($(el));
			if (value !== null) data.steps = value;
		}
	});

	// Parse peak heart rate - it's embedded in "Peak HR: 181" format
	$("*").each((_, el) => {
		const text = $(el).text();
		if (text.includes("Peak HR:") && !data.peakHeartRate) {
			const match = text.match(/Peak HR:\s*(?:&nbsp;)?\s*(\d+)/);
			if (match) {
				const value = parseInt(match[1]);
				if (!isNaN(value)) data.peakHeartRate = value;
			}
		}
	});

	// Parse heart rate zone minutes
	// Zone minutes appear in bar-bumber elements in order: gray, blue, green, orange, red
	const zoneMinutes: number[] = [];
	$("p.bar-bumber").each((_, el) => {
		const text = $(el).text().trim();
		const value = parseInt(text);
		if (!isNaN(value)) {
			zoneMinutes.push(value);
		}
	});

	// Assign zone minutes in order (gray, blue, green, orange, red)
	if (zoneMinutes.length >= 5) {
		data.minutesInGrayZone = zoneMinutes[0];
		data.minutesInBlueZone = zoneMinutes[1];
		data.minutesInGreenZone = zoneMinutes[2];
		data.minutesInOrangeZone = zoneMinutes[3];
		data.minutesInRedZone = zoneMinutes[4];
		data.activeMinutes =
			zoneMinutes[0] +
			zoneMinutes[1] +
			zoneMinutes[2] +
			zoneMinutes[3] +
			zoneMinutes[4];
	}

	// Parse TREADMILL section
	// Find the "TREADMILL PERFORMANCE TOTALS" header and extract data from its section
	$("p").each((_, el) => {
		const text = $(el).text().trim();
		if (text.includes("TREADMILL PERFORMANCE TOTALS")) {
			// Get the parent table/container and find distance and time within it
			const container = $(el).closest("table");
			let foundTreadmill = false;

			// Look for the distance value - it's in a span with miles unit
			container
				.find("td")
				.each((_, td) => {
					const tdHtml = $(td).html() || "";
					const tdText = $(td).text();

					// Check if this td contains "miles" - that's the treadmill distance
					if (tdText.includes("miles") && !foundTreadmill) {
						const distanceMatch = tdHtml.match(
							/>[\s]*(\d+\.?\d*)[\s]*<\/span>[\s]*<span[^>]*>(?:&nbsp;)?[\s]*miles/i
						);
						if (distanceMatch) {
							const distance = parseFloat(distanceMatch[1]);
							if (!isNaN(distance)) {
								data.treadmillDistance = distance;
								foundTreadmill = true;
							}
						}
					}
				});
		}
	});

	// Parse ROWER section
	// Find the "ROWER PERFORMANCE TOTALS" header and extract data from its section
	$("p").each((_, el) => {
		const text = $(el).text().trim();
		if (text.includes("ROWER PERFORMANCE TOTALS")) {
			const container = $(el).closest("table");
			let foundRower = false;

			// Look for the distance value - it's in a span with meters unit
			container
				.find("td")
				.each((_, td) => {
					const tdHtml = $(td).html() || "";
					const tdText = $(td).text();

					// Check if this td contains "m " (meters) - that's the rower distance
					if ((tdText.includes(" m ") || tdText.match(/\d+\s*m\s/)) && !foundRower) {
						const distanceMatch = tdHtml.match(
							/>[\s]*(\d+\.?\d*)[\s]*<\/span>[\s]*<span[^>]*>(?:&nbsp;)?[\s]*m[\s<]/i
						);
						if (distanceMatch) {
							const distance = parseFloat(distanceMatch[1]);
							if (!isNaN(distance)) {
								data.rowingDistance = distance;
								foundRower = true;
							}
						}
					}
				});
		}
	});

	// Parse times by finding "Total Time" labels and determining which section they're in
	$("p.h2.text-gray").each((_, el) => {
		const labelText = $(el).text().trim();
		if (labelText === "Total Time") {
			// Get the time value from the previous element
			const valueEl = $(el).prev("p.h1.text-gray.text-bold");
			if (valueEl.length) {
				const timeText = valueEl.text().trim();
				const timeInSeconds = timeToSeconds(timeText);

				// Determine if this is treadmill or rower by checking ancestors for section header
				let parent = $(el).parent();
				let isTreadmill = false;
				let isRower = false;

				// Walk up the DOM to find section identifier
				for (let i = 0; i < 20; i++) {
					const parentHtml = parent.html() || "";
					if (parentHtml.includes("TREADMILL PERFORMANCE TOTALS")) {
						isTreadmill = true;
						break;
					}
					if (parentHtml.includes("ROWER PERFORMANCE TOTALS")) {
						isRower = true;
						break;
					}
					parent = parent.parent();
					if (!parent.length) break;
				}

				if (isTreadmill && timeInSeconds !== null && !data.treadmillTime) {
					data.treadmillTime = timeInSeconds;
				} else if (isRower && timeInSeconds !== null && !data.rowingTime) {
					data.rowingTime = timeInSeconds;
				}
			}
		}
	});

	// Also parse Total Distance the same way (as backup/verification)
	$("p.h2.text-gray").each((_, el) => {
		const labelText = $(el).text().trim();
		if (labelText === "Total Distance") {
			// Get the parent td and look for the value
			const parentTd = $(el).closest("td");
			const spanValue = parentTd.find("span.h1.text-gray.text-bold").first();

			if (spanValue.length) {
				const valueText = spanValue.text().trim();
				const value = parseFloat(valueText);

				if (!isNaN(value)) {
					// Determine section by walking up DOM
					let parent = $(el).parent();
					let isTreadmill = false;
					let isRower = false;

					for (let i = 0; i < 20; i++) {
						const parentHtml = parent.html() || "";
						if (parentHtml.includes("TREADMILL PERFORMANCE TOTALS")) {
							isTreadmill = true;
							break;
						}
						if (parentHtml.includes("ROWER PERFORMANCE TOTALS")) {
							isRower = true;
							break;
						}
						parent = parent.parent();
						if (!parent.length) break;
					}

					if (isTreadmill && !data.treadmillDistance) {
						data.treadmillDistance = value;
					} else if (isRower && !data.rowingDistance) {
						data.rowingDistance = value;
					}
				}
			}
		}
	});

	// Parse detailed treadmill and rower stats from inner-table elements
	// The stats are contained in table.inner-table elements with bgcolor="#f5f5f5"
	$("table.inner-table").each((_, table) => {
		const tableText = $(table).text();

		// Identify treadmill stats table (contains mph and INCLINE/ELEVATION)
		if (tableText.includes("mph") && tableText.includes("AVG. SPEED")) {
			// Extract treadmill avg speed
			const avgSpeedMatch = tableText.match(
				/AVG\.\s*SPEED[\s\S]*?(\d+\.?\d*)\s*mph/
			);
			if (avgSpeedMatch && !data.treadmillAvgSpeed) {
				data.treadmillAvgSpeed = parseFloat(avgSpeedMatch[1]);
			}

			// Extract treadmill max speed
			const maxSpeedMatch = tableText.match(
				/AVG\.\s*SPEED[\s\S]*?mph[\s\S]*?Max[:\s]*(\d+\.?\d*)/i
			);
			if (maxSpeedMatch && !data.treadmillMaxSpeed) {
				data.treadmillMaxSpeed = parseFloat(maxSpeedMatch[1]);
			}

			// Extract avg incline
			const avgInclineMatch = tableText.match(
				/AVG\.\s*INCLINE[\s\S]*?(\d+\.?\d*)\s*%/
			);
			if (avgInclineMatch && !data.treadmillAvgIncline) {
				data.treadmillAvgIncline = parseFloat(avgInclineMatch[1]);
			}

			// Extract max incline
			const maxInclineMatch = tableText.match(
				/AVG\.\s*INCLINE[\s\S]*?%[\s\S]*?Max[:\s]*(\d+\.?\d*)/i
			);
			if (maxInclineMatch && !data.treadmillMaxIncline) {
				data.treadmillMaxIncline = parseFloat(maxInclineMatch[1]);
			}

			// Extract avg pace (format: MM:SS)
			const avgPaceMatch = tableText
				.replace(/\u200c/g, "")
				.match(/AVG\.\s*PACE[\s\S]*?(\d{1,2}:\d{2})/);
			if (avgPaceMatch && !data.treadmillAvgPace) {
				data.treadmillAvgPace = timeToSeconds(avgPaceMatch[1]);
			}

			// Extract fastest pace
			const fastestPaceMatch = tableText
				.replace(/\u200c/g, "")
				.match(/Fastest[:\s]*(\d{1,2}:\d{2})/);
			if (fastestPaceMatch && !data.treadmillFastestPace) {
				data.treadmillFastestPace = timeToSeconds(fastestPaceMatch[1]);
			}

			// Extract elevation
			const elevationMatch = tableText.match(
				/ELEVATION[\s\S]*?(\d+\.?\d*)\s*feet/
			);
			if (elevationMatch && !data.treadmillElevation) {
				data.treadmillElevation = parseFloat(elevationMatch[1]);
			}
		}

		// Identify rower stats table (contains watt and 500M SPLIT)
		if (tableText.includes("watt") && tableText.includes("AVG. WATTAGE")) {
			// Extract avg wattage
			const avgWattMatch = tableText.match(
				/AVG\.\s*WATTAGE[\s\S]*?(\d+)\s*watt/
			);
			if (avgWattMatch && !data.rowingAvgWattage) {
				data.rowingAvgWattage = parseInt(avgWattMatch[1]);
			}

			// Extract max wattage
			const maxWattMatch = tableText.match(
				/AVG\.\s*WATTAGE[\s\S]*?watt[\s\S]*?Max[:\s]*(\d+)/i
			);
			if (maxWattMatch && !data.rowingMaxWattage) {
				data.rowingMaxWattage = parseInt(maxWattMatch[1]);
			}

			// Extract avg speed (km/h)
			const avgSpeedMatch = tableText.match(
				/AVG\.\s*SPEED[\s\S]*?(\d+\.?\d*)\s*km\/h/
			);
			if (avgSpeedMatch && !data.rowingAvgSpeed) {
				data.rowingAvgSpeed = parseFloat(avgSpeedMatch[1]);
			}

			// Extract max speed (km/h)
			const maxSpeedMatch = tableText.match(
				/AVG\.\s*SPEED[\s\S]*?km\/h[\s\S]*?Max[:\s]*(\d+\.?\d*)/i
			);
			if (maxSpeedMatch && !data.rowingMaxSpeed) {
				data.rowingMaxSpeed = parseFloat(maxSpeedMatch[1]);
			}

			// Extract 500m split
			const splitMatch = tableText
				.replace(/\u200c/g, "")
				.match(/500M\s*SPLIT[\s\S]*?(\d{1,2}:\d{2})\s*min/);
			if (splitMatch && !data.rowing500mSplit) {
				data.rowing500mSplit = timeToSeconds(splitMatch[1]);
			}

			// Extract max 500m split
			const maxSplitMatch = tableText
				.replace(/\u200c/g, "")
				.match(/500M\s*SPLIT[\s\S]*?Max[:\s]*(\d{1,2}:\d{2})/);
			if (maxSplitMatch && !data.rowingMax500mSplit) {
				data.rowingMax500mSplit = timeToSeconds(maxSplitMatch[1]);
			}

			// Extract avg stroke rate
			const strokeMatch = tableText.match(
				/AVG\.\s*STROKE\s*RATE[\s\S]*?(\d+\.?\d*)/
			);
			if (strokeMatch && !data.rowingAvgStrokeRate) {
				data.rowingAvgStrokeRate = parseFloat(strokeMatch[1]);
			}
		}
	});

	return data;
}
