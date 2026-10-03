# Analytical Dashboard Generation

This is the analytics workspace from the General Championship data project. A person types a question. The system turns that question into a query, draws a chart from the rows that come back, and places the chart on a dashboard.

The work is split across three agents. The planner decides what the question is asking for. The executor retrieves the answer from the stored tables. The chart agent decides how that answer should be drawn. They sit behind one service, and the screen in front is a separate web application. Conversation history and the tables live in Supabase.

The service is in `Backend`. It is a FastAPI application with the chat, text-to-SQL, chart, and dashboard agents. The screen is in `Frontend`. Configuration and keys stay in a local environment file and are not part of this repository.
