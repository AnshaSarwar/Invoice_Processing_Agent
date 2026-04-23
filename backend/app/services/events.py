import asyncio
import json
import logging
from typing import Dict, Set, Any

logger = logging.getLogger(__name__)

class AsyncEventBus:
    """
    A simple asynchronous event bus for broadcasting AI pipeline events 
    to multiple connected SSE clients.
    """
    def __init__(self):
        self._subscribers: Set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        """Register a new subscriber and return their queue."""
        queue = asyncio.Queue()
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        """Remove a subscriber and their queue."""
        self._subscribers.remove(queue)

    async def broadcast(self, data: Dict[str, Any]):
        """Push an event to all active subscribers."""
        if not self._subscribers:
            return

        message = json.dumps(data)
        # We use asyncio.gather to push to all queues concurrently
        tasks = [queue.put(message) for queue in self._subscribers]
        await asyncio.gather(*tasks)

# Global instance
global_event_bus = AsyncEventBus()
