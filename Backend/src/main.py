import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.core.config import settings
from src.core.logging_config import setup_logging
from src.routers import api_router

setup_logging()
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version="0.1.0",
    )

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"], # Allows all origins, we can restrict this to frontend url later
        allow_credentials=True,
        allow_methods=["*"], 
        allow_headers=["*"], 
    )

    # Include routers
    app.include_router(api_router)

    @app.get("/health")
    async def health_check():
        return {"status": "ok"}

    logger.info("Application '%s' v0.1.0 ready", settings.APP_NAME)
    return app

app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="127.0.0.1", port=8000, reload=True)
