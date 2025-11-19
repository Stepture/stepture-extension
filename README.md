# Stepture Extension

<div align="center">

**Automated Documentation Tool for Chrome**

Chrome browser extension that automatically captures user interactions to create step-by-step visual documentation guides.

</div>

## Overview

Stepture is a Manifest V3 Chrome extension that helps in documentation creation by automatically capturing screenshots and tracking user interactions as they navigate through web applications. Simply start capturing, perform your workflow, and Stepture generates a complete visual guide with annotated screenshots showing exactly where you clicked.

## Features

### Capture Capabilities

- **Automatic Screenshot Capture** - Takes screenshots on every user's click interaction
- **Smart Click Tracking** - Records exact click coordinates with visual indicators
- **Navigation Detection** - Automatically tracks page navigations as separate steps
- **Tab-Aware Capture** - Intelligently manages capture state across browser tabs
- **Pause & Resume** - Flexible capture control for complex workflows
- **Device Context Recording** - Captures viewport dimensions, pixel ratio, and screen resolution

### User Experience

- **Side Panel Interface** - Clean, non-intrusive React-based UI in Chrome's side panel
- **Google OAuth Authentication** - Secure authentication via Stepture platform
- **Real-Time Preview** - See captured screenshots with annotations as you work
- **Responsive Display** - Click indicators automatically adjust to container width
- **Loading States** - Smooth skeleton screens and progress indicators
- **Built-In Instructions** - Integrated user guide for easy onboarding

### Technical Highlights

- **Background Upload** - Asynchronous screenshot uploads to Google Drive
- **Smart Link Detection** - Handles various navigation patterns (links, buttons, forms)
- **Form Compatibility** - Preserves form functionality during capture
- **Local Storage Management** - Efficient Chrome local storage usage
- **Auto Token Refresh** - Seamless authentication with automatic token renewal

### Managing Captures

- **Pause** - Temporarily stop capturing without ending the session
- **Resume** - Continue capturing from where you paused
- **Stop** - End the capture and create your documentation

### Creating Documentation

1. Click **Stop Capture** when finished
2. The extension uploads all screenshots to Google Drive
3. A new document is created on the Stepture platform
4. Your browser automatically opens the generated guide

**Built and Maintained by Stepture Team**
