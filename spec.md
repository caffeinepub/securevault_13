# SecureVault

## Current State

The app is a full-stack encrypted vault with:
- Dark theme using deep navy/slate backgrounds with electric cyan (`oklch(0.72 0.18 195)`) as primary
- Multiple screens: LoginScreen, MasterPasswordScreen, VaultView, EntryDetailSheet, EntryFormSheet, SettingsSheet
- Fixed max-width containers (`max-w-3xl`) with some responsive classes but no explicit mobile-first layout optimization
- Sheets slide in from the right (full width on mobile, `sm:max-w-lg` or `sm:max-w-md` on desktop)
- FAB (floating action button) at `bottom-6 right-6`
- Sticky header with search bar and icon buttons
- Filter tabs row below header (horizontally scrollable)
- Toaster hardcoded with dark theme styles

## Requested Changes (Diff)

### Add
- Mobile-first layout adjustments: safe area insets (`env(safe-area-inset-*)`), larger touch targets (min 44px), bottom padding to avoid FAB overlap on mobile
- Light color palette: move from dark navy to a clean light theme while keeping cyan as the accent/primary

### Modify
- `index.css`: Replace dark design tokens with a light palette — light backgrounds (near-white with slight cool tint), dark foreground, cyan primary kept but darkened slightly for contrast on light backgrounds, borders lightened, cards as white/off-white surfaces
- `App.tsx`: Update Toaster to use light theme
- All screens: Ensure touch targets are at least 44px on mobile, inputs have `text-base` (16px) to prevent iOS zoom, adequate padding on small screens
- `VaultView.tsx`: Add `pb-24` to main content area to clear the FAB; ensure header search bar doesn't shrink too small on mobile
- Sheets: Already `w-full` on mobile — confirm they render correctly
- Entry cards: Increase tap area, ensure minimum height comfortable for touch
- Filter tabs: Already scrollable, confirm touch-friendly sizing

### Remove
- Dark background overrides on Toaster (switching to light theme)
- `color-scheme: dark` from html element

## Implementation Plan

1. Redesign `index.css` design tokens for a light palette:
   - Background: near-white with cool blue tint `oklch(0.98 0.005 230)`
   - Card: pure white `oklch(1 0 0)` with subtle border
   - Primary: deeper cyan for contrast on light `oklch(0.52 0.18 200)` (darkened for WCAG AA on white)
   - Secondary: light cool gray `oklch(0.94 0.006 230)`
   - Muted: `oklch(0.92 0.008 230)`
   - Muted-foreground: `oklch(0.48 0.02 230)`
   - Border: `oklch(0.88 0.008 230)`
   - Foreground: near-black `oklch(0.15 0.01 240)`
   - Remove `color-scheme: dark`
   - Update `text-gradient-cyan` to use the darker primary range

2. Mobile layout improvements:
   - Add `pb-safe` / safe-area padding where needed
   - Main vault content: `pb-28` to clear FAB
   - Filter tabs and header already sticky — verify offset math
   - Input font size `text-base` (16px) to prevent iOS zoom on focus
   - Minimum touch target size (h-11 or h-12 for key buttons on mobile)

3. Update `App.tsx` Toaster to `theme="light"` with light-appropriate styles

4. Update background decorative elements in LoginScreen and MasterPasswordScreen to work on light backgrounds (reduce glow opacity, keep subtle)
