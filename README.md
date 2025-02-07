# Activity Tracker 🗓️

A comprehensive habit-tracking web app with cloud sync via GitHub Gists. Track activities with flexible scheduling, pauses, and reminders.
- Available on [Github pages](https://pragadeesh-kms.github.io/activity-tracker/)
## Key Features ✨

### 1. Advanced Task Management
- **Timelines**: Set active periods using date ranges
- **Pauses**: Temporarily disable tracking for specific periods
- **End/Unend**: Archive completed tasks or resume them later
- **Smart Deletion**: Ended tasks auto-remove after 1 month

### 2. Intelligent Reminders 🔔
| Reminder Type | How It Works | Setup Guide |
|---------------|--------------|-------------|
| **Weekly**    | Select specific weekdays | Choose days (SMTWTFS) in weekly modal |
| **Monthly**   | Pick calendar dates | Select dates (1-31) in monthly grid |
| **Frequent**  | Custom intervals | Set days between repeats + start date |

## 🛠️ Setup Guide

1. **Create GitHub Token**:
   - Go to [GitHub Settings → Developer Settings → Tokens](https://github.com/settings/tokens)
   - Create token with `gist` scope
   
2. **Create Gist**:
   - Visit [gist.github.com](https://gist.github.com)
   - Create secret gist named `activity-data.json`
   - Add initial content: `{}`
   - Copy Gist ID from URL: `https://gist.github.com/username/`**`GIST_ID`**

3. **App Configuration**:
   - Open tracker app
   - Click ☰ → Settings
   - Enter GitHub Token and Gist ID
   - Click Login

## 🔄 Data Management
- **100% User Control**: 
  - Stored in **your** GitHub account
  - Credentials saved in browser's local storage
  - Logout removes credentials locally
- **Automatic Sync**: Changes saved to Gist in real-time
- **Export/Import**: Manual backup options available in settings

## Feature Breakdown 🧩

### 🕑 Pause Tasks
- Temporarily stop tracking for specific periods
- Multiple pause ranges supported
- **How to Use**: Click ⏸️ → Select date range

### 📅 Timeline Management
- Define active periods for tasks
- Add multiple timelines per task
- **How to Use**: Click 📆 → Set start/end dates

### 🔔 Reminder Types
1. **Weekly**
   - Select specific weekdays
   - Example: Every Monday/Wednesday/Friday
2. **Monthly**
   - Choose calendar dates
   - Example: 5th and 20th of each month
3. **Frequent**
   - Custom interval (2-31 days)
   - Example: Every 3 days starting Jan 1

### ✏️ Task Actions
| Icon | Action | Description |
|------|--------|-------------|
| ✏️   | Edit    | Change task name |
| ⏸️   | Pause   | Add/remove pause periods |
| 📆   | Timeline| Set active date ranges |
| ⏰   | Reminder| Configure reminder type |
| 🏁   | End     | Archive completed task |
| 🚀   | Unend   | Resume archived task |
| ⛔   | Delete  | Permanent removal |

## Privacy & Security 🔒
- No servers involved - direct Gist access
- GitHub credentials never leave your browser
- Full control over data deletion:
  - Remove via GitHub UI
  - Use app's logout feature
  - Clear browser storage
