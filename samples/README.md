# Sample: monthly video conversion

One table, 12 rows. It mirrors the Supabase table `monthly_chart` that the overview chart "Monthly Content Trends" reads. Column names are the ones the text-to-SQL prompt and `Dashboard.tsx` use: `month`, `total_uploaded`, `total_created`, `total_published`.

Story: a newsroom turns long-form uploads into short-form clips. Each upload yields about nine created clips, and about 8% of those clips are published after review. Counts rise from Nov 2025 through Sep 2026. Oct 2026 is a partial month, so the counts dip.

| Column | Meaning |
| --- | --- |
| `month` | Label like `Jan 2026`. The overview date filter splits this on a space. |
| `total_uploaded` | Long-form source videos uploaded that month. |
| `total_created` | Short-form clips the model created from those uploads. |
| `total_published` | Clips a person approved and published. |

Totals across the 12 rows: uploaded 737, created 6,829, published 525. Publish conversion is 525 / 6,829 = 7.69%.

## How to use it in the app

The screen does not upload this file. Open the **InsightArc** panel (header button). The input placeholder is "How may I help you today?". Check one box under the input, paste one prompt, and send. The two boxes clear each other.

The live answers come from Supabase, not from this CSV. This file is the shape and the column names to point at. For these exact numbers to come back, the same 12 rows need to be what `monthly_chart` returns.

### Make Chart

Check **Make Chart**. Paste:

```
Show me the monthly trend of total_uploaded, total_created, and total_published.
```

That question is the kind the classifier sends to SQL ("Show me monthly trends"). The chart agent should pick `line` (a trend over `month`), with `month` as `xAxisKey` and the three count columns as series. The chart shows up under Workspace → Charts.

### Make Dashboard

Check **Make Dashboard** (this turns Make Chart off). Paste:

```
Create a dashboard of monthly AI video conversion. Include KPI cards for the sum of total_uploaded, the sum of total_created, the sum of total_published, and the conversion rate of total_published divided by total_created. Add a line chart of total_uploaded, total_created, and total_published by month, and a table that lists all 12 months with those three counts.
```

The planner turns that into about six panels (four KPI cards, one line chart, one table) and runs each panel as its own natural-language SQL question. The layout puts KPIs on the top row, the chart under them, and the table full width. It shows up under Workspace → Dashboards.

## Constraints

- Chart types the generator will accept: `bar`, `line`, `pie`, `area`. Do not ask for a funnel.
- `pie` is only for one numeric series and about eight categories or fewer. This table is a time series, so ask for a line.
- Bar and pie charts are trimmed above 30 rows. This file has 12.
- A dashboard table panel keeps at most 20 rows. Say "all 12 months" so the planner does not add a limit of 5–10.
- `month` values must look like `Jan 2026` if you also want the overview range filter (Last 30 Days, Last 3 Months, This Year, All Time) to parse them.
