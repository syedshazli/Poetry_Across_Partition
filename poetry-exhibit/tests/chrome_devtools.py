"""Minimal dependency-free Chrome DevTools client for local QA and map exports."""
import base64
import json
import os
import socket
import struct
from urllib.parse import urlparse

class DevTools:
    """Minimal local Chrome DevTools WebSocket client; no dependencies."""
    def __init__(self, url):
        u = urlparse(url)
        self.sock = socket.create_connection((u.hostname, u.port), timeout=10)
        self.file = self.sock.makefile('rb')
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall((f'GET {u.path} HTTP/1.1\r\nHost: {u.netloc}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
        headers = b''
        while not headers.endswith(b'\r\n\r\n'): headers += self.file.read(1)
        if not headers.startswith(b'HTTP/1.1 101 '): raise RuntimeError(headers.decode())
        self.seq = 0
    def command(self, method, params=None):
        self.seq += 1
        payload = json.dumps({'id':self.seq, 'method':method, 'params':params or {}}).encode()
        length = len(payload)
        header = bytes([0x81, 0x80 | (length if length < 126 else 126)])
        if length >= 126: header += struct.pack('!H', length)
        mask = os.urandom(4)
        self.sock.sendall(header + mask + bytes(b ^ mask[i % 4] for i,b in enumerate(payload)))
        while True:
            first, second = self.file.read(2)
            length = second & 127
            if length == 126: length = struct.unpack('!H', self.file.read(2))[0]
            elif length == 127: length = struct.unpack('!Q', self.file.read(8))[0]
            message = json.loads(self.file.read(length))
            if message.get('id') == self.seq:
                if 'error' in message: raise RuntimeError(message['error'])
                return message.get('result', {})
    def evaluate(self, expression):
        return self.command('Runtime.evaluate', {'expression':expression,'returnByValue':True}).get('result',{}).get('value')

