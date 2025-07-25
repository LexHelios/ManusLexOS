# LexOS H100 Command Center Frontend

A modern, feature-rich frontend for the LexOS H100 Command Center. This application provides a seamless interface for interacting with the H100-powered AI system.

## Features

- **Modern Chat Interface**: Real-time chat with streaming responses
- **Multi-Agent System**: Create and manage specialized AI agents
- **File Library**: Upload, manage, and use files with your AI
- **Settings Panel**: Customize your experience
- **Dark/Light Mode**: Choose your preferred theme
- **Responsive Design**: Works on desktop and mobile

## Tech Stack

- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Zustand** for state management
- **Socket.io** for real-time communication
- **Axios** for API requests
- **React Markdown** for rendering markdown content
- **React Syntax Highlighter** for code blocks

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Project Structure

- `/src/components`: UI components
  - `/chat`: Chat-related components
  - `/agents`: Agent management components
  - `/files`: File library components
  - `/settings`: Settings panel components
  - `/layout`: Layout components (sidebar, header)
  - `/ui`: Reusable UI components
- `/src/lib`: Utility functions and API clients
- `/src/store`: Zustand state stores
- `/src/styles`: Global styles

## API Integration

The frontend communicates with the backend through:

1. REST API (via Axios)
2. WebSockets (via Socket.io)

See `/src/lib/api.ts` and `/src/lib/socket.ts` for implementation details.

## Customization

You can customize the UI by modifying the Tailwind configuration in `tailwind.config.js` and global styles in `/src/styles/globals.css`.

## License

This project is part of the LexOS H100 Command Center and is subject to the same license terms.

