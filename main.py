import os
from starlette.applications import Starlette
from starlette.routing import Mount
from starlette.staticfiles import StaticFiles
from starlette.types import Receive, Scope, Send


class CustomStatic(StaticFiles):
    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """
        The ASGI entry point.
        """
        assert scope["type"] == "http"
        if not self.config_checked:
            await self.check_config()
            self.config_checked = True
        path = self.get_path(scope)
        response = await self.get_response(path, scope)
        response.set_cookie("pk", os.getenv("DETA_PROJECT_KEY"))
        await response(scope, receive, send)
routes = [
    Mount('/', app=CustomStatic(directory='.', html=True), name="static"),
]

app = Starlette(routes=routes)