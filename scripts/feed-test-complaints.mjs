const baseUrl = process.argv[2] || "http://localhost:3000";
const endpoint = `${baseUrl.replace(/\/$/, "")}/api/report`;

const complaints = [
  "The OCPD at Central Police Station asked me for KES 10,000 so they could release my impounded boda boda.",
  "At a roadblock in Embakasi, traffic police demanded chai to avoid a fake speeding ticket.",
  "County licensing officer said my permit would only be signed if I sent something to his M-Pesa number.",
  "A procurement officer in the county health department is inflating medicine tenders and sharing kickbacks.",
  "Our local water office keeps disconnecting homes and asking for unofficial payments to reconnect service.",
  "There are repeated threats and harassment from officers at the station after I refused to pay a bribe.",
  "During party primaries, agents were paying voters in cash near the polling center in broad daylight.",
  "Someone in public works requested money to move my application ahead of other people on the waiting list.",
  "This website is nonsense and you are all useless idiots with no real case here.",
  "I have concerns about misuse of CDF funds by local officials but I do not yet have enough details.",
];

async function submitComplaint(rawComplaint, index) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw_complaint: rawComplaint }),
  });

  let payload = {};

  try {
    payload = await response.json();
  } catch {
    payload = { message: "Non-JSON response" };
  }

  console.log(`\n[${index + 1}/${complaints.length}] ${rawComplaint}`);
  console.log(`status=${response.status} success=${String(payload?.success ?? false)} duplicate=${String(payload?.duplicate ?? false)}`);
  console.log(`message=${payload?.message || "(no message)"}`);
}

async function run() {
  console.log(`Submitting ${complaints.length} test complaints to ${endpoint}`);

  for (let i = 0; i < complaints.length; i += 1) {
    await submitComplaint(complaints[i], i);
  }

  console.log("\nDone.");
}

run().catch((error) => {
  console.error("Failed to submit test complaints:", error instanceof Error ? error.message : error);
  process.exit(1);
});
