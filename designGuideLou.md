# Design Language Guide: Ryo Lu-Inspired Portfolio

## Core Philosophy

This design system embodies the clean, minimal, and thoughtful aesthetic pioneered by Ryo Lu at Notion, Stripe, and Cursor. The guiding principle is: **let the work speak through strategic restraint**.

---

## 1. Spatial Design & White Space

### The Notion Principle
White space is not empty space—it's intentional breathing room that creates hierarchy and focus.

**Rules:**
- Use generous margins (minimum 80px on desktop, 24px on mobile)
- Content max-width: 720-900px for optimal readability
- Vertical spacing should follow a consistent scale: 8px, 16px, 24px, 32px, 48px, 64px, 96px, 128px
- Allow images and key visual elements to break out of text constraints when needed
- Line height for body text: 1.6-1.8 for comfortable reading
- Paragraph spacing: 24-32px between paragraphs

**Key Concept:**
> "Whitespace should feel effortless, not sparse. The content should breathe, not float."

---

## 2. Typography

### Hierarchy Through Scale and Weight
Typography should be functional first, beautiful second.

**Font Stack:**
```
Primary: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui
Monospace (for code/specs): 'SF Mono', 'Monaco', 'Cascadia Code', monospace
```

**Scale:**
- H1 (Project Title): 48-56px, font-weight: 600-700, letter-spacing: -0.02em
- H2 (Section Headers): 32-40px, font-weight: 600, letter-spacing: -0.01em
- H3 (Subsections): 24-28px, font-weight: 600
- Body: 16-18px, font-weight: 400, line-height: 1.6
- Caption/Meta: 14-15px, font-weight: 400-500, opacity: 0.6-0.7

**Rules:**
- Never use more than 2 font families
- Hierarchy comes from size, weight, and spacing—not color
- Keep all-caps usage minimal (only for small labels/tags)
- Letter-spacing for large headings should be slightly negative (-0.01 to -0.02em)

---

## 3. Color Palette

### Minimal & Purposeful
Color should enhance, not distract. Default to grayscale; use color sparingly and intentionally.

**Base Palette:**
```css
Background: #FFFFFF (pure white)
Text Primary: #1A1A1A (near black, not pure black)
Text Secondary: #6B6B6B (60% opacity equivalent)
Text Tertiary: #A3A3A3 (40% opacity equivalent)
Divider/Border: #E5E5E5 (light gray)
```

**Accent Colors (use sparingly):**
```css
Primary Accent: #0066FF (clear blue) or #000000 (when going ultra-minimal)
Success/Active: #00C853
Hover State: rgba(0, 0, 0, 0.05)
```

**Rules:**
- Background should always be white or very light (98-100% white)
- Use color for interaction states, links, and minimal accents only
- Images and work samples provide the color—the UI should recede
- Avoid gradients, shadows, and decorative color
- When in doubt, use grayscale

---

## 4. Layout & Grid

### Structured Flexibility
The grid should guide, not constrain.

**Grid System:**
- 12-column grid for complex layouts
- Single-column for narrative content (720px max-width)
- Generous gutters: 32px minimum on desktop, 16px on mobile
- Consistent alignment: left-aligned text, centered or left-aligned images

**Layout Patterns for Case Studies:**

1. **Hero Section**
   - Full-width image or minimal text introduction
   - Project title + company/role metadata
   - 100vh or 70vh height for impact

2. **Content Sections**
   - Alternating text-left/image-right, image-left/text-right
   - Never more than 2 columns for text
   - Images can span 50-100% width depending on impact

3. **Image Galleries**
   - 1-2 column max
   - Equal spacing between images (24-32px)
   - Allow images to determine their own aspect ratios

**Rules:**
- Maintain consistent left margin for all text blocks
- Images can break alignment for visual interest
- Never center-align body text (only titles when appropriate)
- Mobile: everything stacks to single column

---

## 5. Imagery & Visual Assets

### Images as the Hero
Your work should be the visual centerpiece. The interface exists to frame it.

**Image Treatment:**
- No borders, shadows, or frames on images (unless work requires it)
- Use full-bleed images for impact
- Maintain original aspect ratios—never crop or distort
- High-quality only (2x retina minimum)
- Lazy loading for performance

**Image Layouts:**
```
Full-width hero: 100% width, aspect ratio as needed
Standard: 720-900px width, centered
Side-by-side: 50/50 split with 24-32px gap
Grid: 2-column max, equal heights optional
```

**Rules:**
- Let images have generous top/bottom padding (48-96px)
- Never place text over images unless it's part of the work being shown
- Images should never compete with each other—one focal point at a time
- Use actual project screenshots, not mockups (when possible)

---

## 6. Navigation

### Subtle & Persistent
Navigation should be present but never compete with content.

**Header:**
- Fixed or static top navigation
- Height: 60-80px
- Background: white with subtle border or transparent
- Logo/name on left, minimal menu on right
- Font size: 14-16px

**Menu Items:**
- 3-5 items max (Work, About, Contact)
- Hover state: subtle underline or color shift
- Active state: bold weight or accent color
- Mobile: hamburger menu that slides in

**Rules:**
- Navigation should feel "out of the way" until needed
- No mega-menus or dropdowns
- Keep it minimal—if you need more than 5 items, restructure
- Scroll behavior: can hide on scroll down, show on scroll up

---

## 7. Project Case Study Structure

### Narrative Flow
Each case study should tell a story: context → problem → process → solution → impact.

**Recommended Sections:**
1. **Hero** - Project title, company, role, year
2. **Overview** - 2-3 sentence project summary
3. **Context** - Background, problem space, constraints
4. **Process** - Design thinking, iterations, key decisions
5. **Solution** - Final designs with annotations
6. **Impact** - Results, metrics, learnings

**Content Guidelines:**
- Start with the why, not the what
- Show process, not just polish
- Include failures and iterations (builds credibility)
- Use visuals to break up text every 2-3 paragraphs
- End with reflection or learning

**Text Length:**
- Overview: 50-100 words
- Each section: 100-300 words
- Total case study: 800-1500 words optimal

---

## 8. Interaction & Motion

### Purposeful, Not Playful
Motion should feel responsive and intentional, never gratuitous.

**Animation Principles:**
- Duration: 200-300ms for most interactions
- Easing: ease-out for entries, ease-in-out for hover states
- Subtle hover states on clickable elements
- Page transitions: simple fade or slide (200-400ms)

**Recommended Interactions:**
```css
Hover on links: opacity 0.7 or subtle underline
Hover on cards: slight y-axis lift (-2px) + subtle shadow
Scroll reveals: fade-up on elements (once, not repeatedly)
Image hover: slight scale (1.02x) or no effect
```

**Rules:**
- No animations over 500ms
- No parallax scrolling (too trendy, ages poorly)
- No auto-playing videos on load
- Respect `prefers-reduced-motion` media query
- When in doubt, no animation is better than bad animation

---

## 9. Components

### Building Blocks

**Card Component:**
```
- Background: white
- Border: none or 1px solid #E5E5E5
- Padding: 24-32px
- Border-radius: 0-8px max
- Hover: subtle shadow or lift
```

**Button:**
```
- Primary: black background, white text
- Secondary: white background, black border, black text
- Padding: 12-16px horizontal, 8-12px vertical
- Border-radius: 4-6px
- Font-weight: 500-600
- Font-size: 14-16px
```

**Tag/Label:**
```
- Background: #F5F5F5
- Text: #6B6B6B
- Padding: 4-8px horizontal, 2-4px vertical
- Border-radius: 3-4px
- Font-size: 12-14px
- Font-weight: 500
```

---

## 10. Responsive Design

### Mobile-First Thinking
The experience should be equally considered on all devices.

**Breakpoints:**
```css
Mobile: 0-768px
Tablet: 769-1024px
Desktop: 1025px+
Wide: 1440px+
```

**Mobile Adaptations:**
- Stack all multi-column layouts
- Increase touch targets to 44x44px minimum
- Reduce font sizes by 10-20%
- Reduce vertical spacing by 30-40%
- Full-width images on mobile
- Hamburger menu below 768px

**Rules:**
- Test on actual devices, not just browser tools
- Navigation should be thumb-friendly
- Avoid horizontal scrolling at all costs
- Maintain the same visual hierarchy on mobile

---

## 11. Performance & Technical

### Fast & Accessible
Good design includes performance and accessibility.

**Performance:**
- Lazy load images below the fold
- Optimize images (WebP with JPEG fallback)
- Minimal JavaScript (vanilla JS or lightweight framework)
- No unnecessary animations or libraries
- Target: < 2s load time on 3G

**Accessibility:**
- Minimum contrast ratio: 4.5:1 for body text
- All interactive elements keyboard navigable
- Semantic HTML (h1, h2, nav, main, article, etc.)
- Alt text for all images
- Focus states visible on all interactive elements

**SEO:**
- Meaningful page titles and meta descriptions
- Proper heading hierarchy
- Fast load times
- Mobile-friendly

---

## 12. Anti-Patterns to Avoid

**Don't:**
- Use more than 3 font weights
- Add drop shadows to everything
- Use bright, saturated colors as backgrounds
- Create busy, cluttered layouts
- Add animations for the sake of "delight"
- Use carousels/sliders (poor UX)
- Auto-play anything
- Use generic stock photos
- Over-explain or write fluffy content
- Hide important content behind interactions

**Remember:**
> "Minimalism isn't about having less. It's about making room for more of what matters."

---

## 13. Content Strategy

### Show, Don't Just Tell

**Writing Tone:**
- Clear and direct
- Avoid jargon unless necessary
- First person for personal reflections
- Focus on decisions and rationale, not just descriptions
- Be honest about challenges and constraints

**Content Hierarchy:**
1. Visuals (images, diagrams, mockups)
2. Headings and key points
3. Supporting text
4. Metadata and supplementary info

**The Ryo Approach:**
- Lead with the problem and why it matters
- Show your thinking through process shots
- Explain key decisions with context
- End with honest reflection on outcomes and learnings

---

## 14. Example Implementation Notes

### For Your Code-Generating LLM

When generating code, follow these patterns:

**HTML Structure:**
```html
<main class="case-study">
  <section class="hero">
    <!-- Full-width hero image or title -->
  </section>
  
  <article class="content">
    <section class="section">
      <h2>Section Title</h2>
      <p>Content...</p>
    </section>
    
    <figure class="image-full">
      <img src="..." alt="...">
      <figcaption>Optional caption</figcaption>
    </figure>
  </article>
</main>
```

**CSS Patterns:**
```css
/* Spacing scale */
--space-xs: 8px;
--space-sm: 16px;
--space-md: 24px;
--space-lg: 32px;
--space-xl: 48px;
--space-2xl: 64px;
--space-3xl: 96px;

/* Colors */
--color-text: #1A1A1A;
--color-text-light: #6B6B6B;
--color-border: #E5E5E5;
--color-bg: #FFFFFF;
--color-accent: #0066FF;

/* Typography */
--font-sans: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--text-base: 16px;
--line-height: 1.6;
```

---

## Quick Reference Checklist

Before shipping any design:

- [ ] Is there enough white space? (Can elements breathe?)
- [ ] Is the typography hierarchy clear?
- [ ] Are colors used sparingly and purposefully?
- [ ] Do images have room to shine?
- [ ] Is navigation subtle and unobtrusive?
- [ ] Are interactions smooth and purposeful (200-300ms)?
- [ ] Does it work beautifully on mobile?
- [ ] Is it fast? (< 2s load time)
- [ ] Is it accessible? (WCAG AA minimum)
- [ ] Does the work speak louder than the design?

---

## Summary: The Ryo Lu Philosophy

**Restraint over decoration.** Every element should serve a purpose. White space is a design element. Typography creates hierarchy. Images tell the story. The interface should disappear, leaving only the work.

This is design that feels effortless because of the effort that went into making it simple.

> "The best portfolio is one where the work is remembered, not the website."

---

## Additional Resources

- **Notion's Design Principles**: Clarity, flexibility, power
- **Study References**: Notion.so, Linear.app, Stripe.com (for similar aesthetics)
- **Typography**: Inter (Google Fonts), SF Pro (Apple)
- **Inspiration**: Swiss Design, Bauhaus, Dieter Rams' principles

---

*This guide should be treated as a starting point. Adapt based on your specific work and personality, but maintain the core principles of clarity, restraint, and letting the work shine.* 