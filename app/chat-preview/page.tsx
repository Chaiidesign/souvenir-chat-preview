'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  AiWebBrowsingIcon, PdfIcon, AiImageIcon, AiFileIcon,
  CsvIcon, NotionIcon, GoogleDriveIcon, SlackIcon, GithubIcon,
  FlowIcon, AiBrain01Icon, Checkmark, Spinner,
  ThumbsUpIcon, ThumbsDownIcon,
  AiVisionRecognitionIcon, Brain02Icon, Idea01Icon, Task01Icon,
  HierarchySquare01Icon, GitMergeIcon, Copy01Icon,
  // Replacements for @strange-huge icons
  Bookmark01Icon, Exchange01Icon, QuillWrite01Icon,
  AiNetworkIcon, CalculateIcon, AiMagicIcon, AudioWave01Icon,
  GlobeXIcon, CodeIcon,
  // Callout icons
  InformationCircleIcon, Alert01Icon, Cancel01Icon, CheckmarkCircle01Icon,
} from '@hugeicons/core-free-icons'
import { LlmIcon } from '@strange-huge/icons/llm'

// ─────────────────────────────────────────────────────────────────────────────
//  Assets
// ─────────────────────────────────────────────────────────────────────────────
const THINKING_WORDS = ['Thinking…', 'Analysing…', 'Processing…', 'Considering…']

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────
type Phase = 'idle' | 'user-sent' | 'souvenir' | 'thinking' | 'choosing' | 'model-chosen' | 'researching' | 'streaming' | 'complete'

type ActivityType =
  | 'web-search' | 'read-pdf' | 'scan-image' | 'scan-screenshot'
  | 'read-pins' | 'run-code' | 'read-file' | 'read-csv'
  | 'connector-notion' | 'connector-drive' | 'connector-slack' | 'connector-github'
  | 'calculate' | 'generate-image' | 'process-audio' | 'synthesise'

interface ActivityItem {
  type: ActivityType
  detail?: string
  resultCount?: number
  results?: { title: string; domain: string }[]
  badge?: boolean // show "Action" badge
}

interface ReasoningStep {
  verb: string    // past-tense, completed: "Strategized…"
  detail: string  // what it was about
  summary: string // paragraph shown when row is expanded
}

interface ActionGroup {
  activityCount: number // how many activities in this group
  summary: string       // "Let me now extract insights per section:"
}

interface Citation {
  title: string
  domain: string
}

// ─────────────────────────────────────────────────────────────────────────────
//  Open UI structured output types
// ─────────────────────────────────────────────────────────────────────────────
// Rich table cell — plain string/number OR a structured cell object
interface TableBadgeStyle { label: string; color: string; bg: string; border?: string }
type TableCellValue =
  | string
  | number
  | { type: 'badge';   label: string; color: string; bg: string; border?: string }
  | { type: 'check';   value: boolean }  // ✓ green / — gray
  | { type: 'rich';    text: string; sub?: string; badge?: TableBadgeStyle }

interface TableData {
  caption?: string
  headers: string[]
  rows: TableCellValue[][]
  // Visual variant — drives all rendering decisions
  variant?: 'basic' | 'striped' | 'compact' | 'badges' | 'financial' | 'hoverable' | 'minimal' | 'feature-comparison' | 'mixed-content'
  sortable?: boolean      // click headers to sort asc/desc
  totalsRow?: boolean     // last row gets bold separator above
  accentRows?: number[]   // row indices get left-border highlight
  // Auto-badge: map raw string values → badge styles (used with variant='badges')
  badgeMap?: Record<string, { color: string; bg: string; border?: string }>
}

interface BarChartData {
  title?: string
  unit?: string
  bars: { label: string; value: number; color?: string }[]
  maxValue?: number
  // Extended for multi-variant bar charts
  variant?: 'vertical' | 'horizontal' | 'grouped' | 'stacked' | 'stacked-100' | 'positive-negative'
  datasets?: { label: string; color?: string; values: number[] }[]  // grouped/stacked
  labels?: string[]                                                   // x-axis labels for multi-dataset charts
}

interface StepsData {
  title?: string
  steps: { label: string; description?: string }[]
}

type OpenUIData = TableData | BarChartData | StepsData

// ─────────────────────────────────────────────────────────────────────────────
//  Extended structured output types (for responseBlocks)
// ─────────────────────────────────────────────────────────────────────────────
interface CodeData {
  language: string
  code: string
  caption?: string
}

interface CalloutData {
  variant: 'info' | 'warning' | 'success' | 'error' | 'tip'
  title?: string
  body: string
}

interface TagsData {
  title?: string
  tags: { label: string; color?: string }[]
}

interface FollowUpsData {
  prompts: string[]
}

interface PieChartData {
  title?: string
  unit?: string
  centerLabel?: string
  segments: { label: string; value: number; color?: string }[]
}

interface LineChartData {
  title?: string
  unit?: string
  xLabel?: string
  yLabel?: string
  lines: { label: string; color?: string; points: { x: string; y: number }[] }[]
}

interface CardData {
  title?: string
  subtitle?: string
  body: string
  badge?: string
  badgeColor?: string
}

interface ConnectorErrorData {
  connector: string   // e.g. 'Gmail'
  icon?: string       // emoji fallback e.g. '✉️'
  message: string     // human-readable explanation shown under the title
  cta: string         // button label e.g. 'Reconnect Gmail'
}

interface SearchTimeoutData {
  query: string       // the search query that timed out
  message: string     // fallback explanation
  cta: string         // button label e.g. 'Retry search'
}

// Discriminated union — one block in a response sequence
type ResponseBlock =
  | { kind: 'text';             content: string; citations?: Citation[] }
  | { kind: 'table';            data: TableData }
  | { kind: 'bar-chart';        data: BarChartData }
  | { kind: 'steps';            data: StepsData }
  | { kind: 'code';             data: CodeData }
  | { kind: 'callout';          data: CalloutData }
  | { kind: 'tags';             data: TagsData }
  | { kind: 'follow-ups';       data: FollowUpsData }
  | { kind: 'pie-chart';        data: PieChartData }
  | { kind: 'line-chart';       data: LineChartData }
  | { kind: 'card';             data: CardData }
  | { kind: 'connector-error';  data: ConnectorErrorData }
  | { kind: 'search-timeout';   data: SearchTimeoutData }

interface ScenarioData {
  id: string
  name: string
  description: string
  userQuery: string
  attachment?: { type: 'pdf' | 'image' | 'csv' | 'pin'; name: string }
  skipRouting?: boolean       // S1: instant, skip thinking/choosing
  activitiesFirst?: boolean   // S6: show activities before reasoning steps
  hasActivities: boolean
  reasoningSteps: ReasoningStep[]
  thinkingSummary: string     // the paragraph for "Thinking ›" expanded
  activities: ActivityItem[]
  actionGroups: ActionGroup[] // how to batch activities (empty = no grouping)
  response: string            // for legacy text-only scenarios
  researchTitle: string | null
  citations?: Citation[]
  responseType?: 'text' | 'table' | 'bar-chart' | 'steps' // legacy: S10/S11/S12
  openUIData?: OpenUIData                                   // legacy: S10/S11/S12
  responseBlocks?: ResponseBlock[]                         // new: mixed content model
}

// ─────────────────────────────────────────────────────────────────────────────
//  Icon helpers
// ─────────────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function HIcon({ icon, size = 14, color = '#827A74', strokeWidth = 1.5 }: { icon: any; size?: number; color?: string; strokeWidth?: number }) {
  return <HugeiconsIcon icon={icon} size={size} color={color} strokeWidth={strokeWidth} />
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ACTIVITY_ICON: Record<ActivityType, { icon: any; isHuge: boolean }> = {
  'web-search':        { icon: AiWebBrowsingIcon,  isHuge: true },
  'read-pdf':          { icon: PdfIcon,             isHuge: true },
  'scan-image':        { icon: AiImageIcon,         isHuge: true },
  'scan-screenshot':   { icon: AiImageIcon,         isHuge: true },
  'read-pins':         { icon: Bookmark01Icon,      isHuge: true },
  'run-code':          { icon: CodeIcon,            isHuge: true },
  'read-file':         { icon: AiFileIcon,          isHuge: true },
  'read-csv':          { icon: CsvIcon,             isHuge: true },
  'connector-notion':  { icon: NotionIcon,          isHuge: true },
  'connector-drive':   { icon: GoogleDriveIcon,     isHuge: true },
  'connector-slack':   { icon: SlackIcon,           isHuge: true },
  'connector-github':  { icon: GithubIcon,          isHuge: true },
  'calculate':         { icon: CalculateIcon,       isHuge: true },
  'generate-image':    { icon: AiMagicIcon,         isHuge: true },
  'process-audio':     { icon: AudioWave01Icon,     isHuge: true },
  'synthesise':        { icon: AiNetworkIcon,       isHuge: true },
}

const ACTIVITY_VERB: Record<ActivityType, string> = {
  'web-search':        'Searching the web',
  'read-pdf':          'Reading PDF',
  'scan-image':        'Scanning image',
  'scan-screenshot':   'Analysing screenshot',
  'read-pins':         'Reading your pins',
  'run-code':          'Running command',
  'read-file':         'Reading file',
  'read-csv':          'Reading data',
  'connector-notion':  'Connecting to Notion',
  'connector-drive':   'Connecting to Drive',
  'connector-slack':   'Reading Slack',
  'connector-github':  'Reading repository',
  'calculate':         'Calculating',
  'generate-image':    'Generating image',
  'process-audio':     'Processing audio',
  'synthesise':        'Synthesising',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REASONING_ICON: Record<string, { icon: any; isHuge: boolean }> = {
  'Considered':  { icon: AiVisionRecognitionIcon, isHuge: true  }, // perceiving, observing
  'Evaluated':   { icon: Brain02Icon,             isHuge: true  }, // deep cognitive weighing
  'Mapped':      { icon: HierarchySquare01Icon,   isHuge: true  }, // charting structure/connections
  'Identified':  { icon: Idea01Icon,              isHuge: true  }, // eureka / finding the key insight
  'Planned':     { icon: Task01Icon,              isHuge: true  }, // steps, sequencing
  'Strategized': { icon: FlowIcon,               isHuge: true  }, // paths and flow
  'Synthesised': { icon: GitMergeIcon,            isHuge: true  }, // combining threads
}

// ─────────────────────────────────────────────────────────────────────────────
//  Model options
// ─────────────────────────────────────────────────────────────────────────────
const MODEL_OPTIONS = [
  { id: 'Claude',     llmId: 'Claude',      name: 'claude sonnet' },
  { id: 'OpenAI',     llmId: 'OpenAI',      name: 'gpt-4o' },
  { id: 'Gemini',     llmId: 'Gemini',      name: 'gemini 2.0' },
  { id: 'Mistral',    llmId: 'Mistral',     name: 'mistral large' },
  { id: 'DeepSeek',   llmId: 'DeepSeek',    name: 'deepseek-v3' },
  { id: 'Perplexity', llmId: 'Perplexity',  name: 'sonar large' },
]

// ─────────────────────────────────────────────────────────────────────────────
//  Scenario data — 8 scenarios
// ─────────────────────────────────────────────────────────────────────────────
const SCENARIOS: ScenarioData[] = [
  // ── S1: Simple answer ──────────────────────────────────────────────────────
  {
    id: 'S1', name: 'Simple answer', description: 'Direct factual question — no tools, no routing',
    userQuery: 'What is product-market fit?',
    skipRouting: true,
    hasActivities: false,
    reasoningSteps: [],
    thinkingSummary: '',
    activities: [], actionGroups: [],
    response: 'Product-market fit is when a product satisfies a strong market demand — the point where a meaningful segment of users not only want what you\'ve built, but pull it into their lives without being pushed.\n\nThe clearest signal isn\'t a metric — it\'s a feeling the team shares. Retention curves flatten. Word-of-mouth starts compounding. Support tickets shift from "how do I" to "can you add". People would be genuinely disappointed if the product disappeared.\n\nPMF is not a single moment. It\'s a threshold you cross, then have to keep earning.',
    researchTitle: null,
  },

  // ── S2: Deep reasoning ─────────────────────────────────────────────────────
  {
    id: 'S2', name: 'Deep reasoning', description: 'Complex strategy question — Adaptive Thinking only, no web/tools',
    userQuery: 'Should Souvenir prioritise B2C or B2B first?',
    hasActivities: false,
    reasoningSteps: [
      {
        verb: 'Considered', detail: 'the product stage and what "prioritise" actually means here',
        summary: 'The question of B2C vs B2B isn\'t purely a go-to-market question — **it\'s a product definition question.** What "Souvenir" means is different depending on who you\'re selling to. I need to hold both versions clearly before recommending one.',
      },
      {
        verb: 'Evaluated', detail: 'B2C and B2B revenue models for memory-layer AI tools',
        summary: 'B2C: long trust-building cycle, lower ARPU, but **defensible through personal data density and habit formation.** B2B: faster revenue, higher ACV, but risks positioning Souvenir as a productivity tool rather than a personal memory system — which **undermines the core thesis.**',
      },
      {
        verb: 'Mapped', detail: 'Souvenir\'s current traction signals against both paths',
        summary: 'Current users are individuals using it for personal knowledge management. No enterprise inbound yet. **The product\'s differentiation — "your memory, not a company\'s knowledge base" — is fundamentally B2C language.** Going B2B now would require a significant re-framing.',
      },
      {
        verb: 'Identified', detail: 'the sequencing that preserves optionality',
        summary: '**The winning move is to nail B2C first** — not because enterprise is wrong, but because individual user trust creates the data density that eventually makes the B2B pitch undeniable. **You can\'t have a credible "team memory" product without first proving "personal memory" works.**',
      },
    ],
    thinkingSummary: 'I worked through Souvenir\'s B2C vs B2B question from four angles: product definition, revenue model tradeoffs, current traction signals, and sequencing optionality. The core tension is that **B2B converts faster but would require repositioning Souvenir away from its core thesis — personal memory.** B2C is slower to monetise but builds the **data density and trust** that makes any future B2B pitch genuinely defensible. **The recommendation: nail individual users first**, use that proof to open team/enterprise later.',
    activities: [], actionGroups: [],
    response: '**B2C first — clearly.**\n\nNot because B2B is wrong for Souvenir eventually, but because going B2B now would require you to redefine what Souvenir is, and that\'s the wrong trade at this stage.\n\nThe core value proposition — "your memory, not a company\'s knowledge base" — is B2C language. It\'s personal. It\'s about the individual\'s cognitive continuity. The moment you lead with B2B, you\'re competing with Notion, Confluence, and every internal wiki tool. That\'s a crowded, price-sensitive market where Souvenir has no existing advantage.\n\nB2C gives you the data density that eventually makes the B2B pitch real. A team product built on top of demonstrated individual trust is a much stronger sell than the other way around.\n\n**The sequence:** Individual users → prove retention → small team pilots (designers, researchers, PMs who already use it personally) → enterprise.',
    researchTitle: 'Reasoned through B2C vs B2B prioritisation for Souvenir',
  },

  // ── S3: Web research with citations ────────────────────────────────────────
  {
    id: 'S3', name: 'Web research', description: 'Research question — web search + pins + inline citations',
    userQuery: 'What are the latest AI startup GTM strategies in 2026?',
    hasActivities: true,
    reasoningSteps: [
      {
        verb: 'Planned', detail: 'what to search for and in what order',
        summary: 'I need current 2026 information so training data alone won\'t cut it. I\'ll search for the dominant GTM patterns, then specifically for **founder-led content** which I know has been accelerating, then check Chai\'s own pins for any saved research on this.',
      },
      {
        verb: 'Strategized', detail: 'how to connect web findings to Souvenir\'s specific situation',
        summary: 'Generic startup GTM advice won\'t be useful here. **I need to filter everything through the lens of: what applies to a B2C AI memory product launching in mid-2026 with a small team.**',
      },
    ],
    thinkingSummary: 'I planned a two-part search — **general 2026 GTM patterns first**, then the **founder-led content trend** specifically — and cross-referenced against Chai\'s saved pins. My filter throughout: **what actually applies to a small-team B2C AI product launching mid-2026**, not generic startup advice.',
    activities: [
      {
        type: 'web-search', badge: true,
        detail: 'AI startup GTM strategies 2026 traction growth',
        resultCount: 10,
        results: [
          { title: 'Top Marketing Strategies for Startups in 2026', domain: 'excellofficial.com' },
          { title: 'Five Growth Strategies Every Early-Stage Startup Should Explore', domain: 'entrepreneurship.edu.au' },
          { title: 'Your 2026 Marketing Strategy for Startups', domain: 'dannyrae.com' },
        ],
      },
      {
        type: 'web-search', badge: true,
        detail: 'founder-led content distribution AI startup 2026',
        resultCount: 7,
        results: [
          { title: 'GTMfund has rewritten the distribution playbook for the AI era', domain: 'techcrunch.com' },
          { title: 'Why Founder and Team-Led Content Is the Growth Engine', domain: 'thestartupfounders.co' },
          { title: 'How to Build a $1M ARR AI App in 2026: Distribution Secrets', domain: 'ainything.ai' },
        ],
      },
      {
        type: 'read-pins',
        detail: 'startup growth, marketing, distribution',
        resultCount: 3,
        results: [
          { title: 'Andrew Chen — The Cold Start Problem notes', domain: 'pin' },
          { title: 'Lenny\'s Newsletter — Retention curves and PMF signals', domain: 'pin' },
          { title: 'YC application draft — traction section', domain: 'pin' },
        ],
      },
    ],
    actionGroups: [],
    response: 'The old playbook is dead. "Build a great product, marketing will follow" no longer works — distribution is now the moat.{1}\n\n**Founder-led content is the dominant channel.**{2} Lovable reached $20M ARR in under a year with ~100 employees, and their Head of Growth credits it entirely to founder-led content. A single founder account isn\'t enough anymore — you need a team that ships and speaks in public.\n\n**Building in public as distribution.**{3} Many $1M+ ARR AI founders in 2026 retrospectively regret staying silent during the build. Documenting the journey — revenue screens, failures, product decisions — creates an organic funnel that runs alongside paid acquisition.\n\n**What this means for Souvenir:** Your saved notes on the Cold Start Problem are directly relevant here.{4} The retention-first framing you flagged in Lenny\'s newsletter maps exactly to the distribution strategy: if you can prove week-4 retention, the distribution story writes itself.',
    researchTitle: 'Synthesised 2026 AI startup GTM strategies',
    citations: [
      { title: 'Top Marketing Strategies for Startups in 2026', domain: 'excellofficial.com' },
      { title: 'GTMfund has rewritten the distribution playbook for the AI era', domain: 'techcrunch.com' },
      { title: 'How to Build a $1M ARR AI App in 2026: Distribution Secrets', domain: 'ainything.ai' },
      { title: 'Andrew Chen — The Cold Start Problem notes', domain: 'pin' },
    ],
  },

  // ── S4: PDF analysis ───────────────────────────────────────────────────────
  {
    id: 'S4', name: 'PDF analysis', description: 'PDF attached — multi-group document reading',
    userQuery: 'I want to understand the insight of this PDF and how can I use it for Souvenir',
    attachment: { type: 'pdf', name: '213-Design-Trend-Report-2026.pdf' },
    hasActivities: true,
    reasoningSteps: [
      {
        verb: 'Planned', detail: 'how to extract and apply a trend report to Souvenir',
        summary: 'A design trend report is dense — I should **read the introduction first** to understand the report\'s framing, then **extract each trend section separately**, then synthesise which trends are actionable for **Souvenir\'s specific visual and product direction.**',
      },
    ],
    thinkingSummary: 'I approached the PDF as a **structured extraction task**: introduction first for framing, then each trend section individually, then a **synthesis pass filtered through Souvenir\'s brand direction and product positioning.** The goal isn\'t to summarise the report — **it\'s to identify what\'s directly applicable.**',
    activities: [
      { type: 'read-file', detail: '213-Design-Trend-Report-2026.pdf — opening, checking page count' },
      { type: 'run-code', badge: true, detail: 'Extracting full text — measuring document length and structure' },
      { type: 'read-pdf', detail: 'Table of contents — mapping all section titles' },
      { type: 'read-pdf', detail: 'Introduction — understanding the report\'s framing and thesis' },
      { type: 'read-pdf', detail: 'Photography and Visual Language chapter' },
      { type: 'read-pdf', detail: 'Future Medieval — Neo-Ornamental Design chapter' },
      { type: 'read-pdf', detail: 'Cyber Goth and Tactile Aesthetics chapter' },
      { type: 'read-pdf', detail: 'Scrapbook and Scanner aesthetic chapter' },
      { type: 'read-pdf', detail: 'Direct Flash Photography chapter' },
    ],
    actionGroups: [
      { activityCount: 4, summary: 'Document loaded and structured. Reading design trend chapters…' },
      { activityCount: 5, summary: 'All chapters read. Mapping findings to Souvenir…' },
    ],
    response: 'I\'ve read the full 213 Design Trend Report and pulled out what\'s directly relevant to Souvenir\'s visual and product direction.\n\n**The report\'s core thesis validates your brand direction perfectly:** audiences are exhausted by overly perfect, generic design and want work that feels "human, tactile, and curated" — which is exactly what Souvenir represents against AI automation anxiety.\n\n**Top 3 trends for Souvenir:**\n\n**Future Medieval** — ornamental dividers, hand-drawn frame elements, serif warmth. Maps directly to Besley and your existing typographic direction.\n\n**Direct Flash photography** — authentic, unfiltered moments. Aligns with Souvenir\'s "memory as it actually was" positioning.\n\n**Scrapbook / Scanner aesthetics** — layered, textured, imperfect. Strong signal for how pin collections could be visually rendered.\n\n**Strategic Priority:** The report\'s overarching message is that 2026 design "gets its personality back" — bolder, more human, more textured. This aligns perfectly with differentiating Souvenir as warm, crafted, memorable AI.',
    researchTitle: 'Analysed 213 Design Trend Report and mapped to Souvenir',
  },

  // ── S5: Image analysis ─────────────────────────────────────────────────────
  {
    id: 'S5', name: 'Image analysis', description: 'Image attached — deep vision analysis with reasoning',
    userQuery: 'Analyse this moodboard and tell me if it matches Souvenir\'s brand direction',
    attachment: { type: 'image', name: 'souvenir-moodboard-v2.png' },
    hasActivities: true,
    reasoningSteps: [
      {
        verb: 'Considered', detail: 'what brand alignment actually means for a moodboard',
        summary: 'Checking "brand alignment" isn\'t just about matching colours — **it\'s about whether the emotional register is right.** I\'ll need to break the image down into discrete dimensions: palette temperature, compositional language, typographic choices, and overall texture. Then cross-reference each against Souvenir\'s brand values.',
      },
      {
        verb: 'Planned', detail: 'a structured framework: palette → composition → typography → synthesis',
        summary: '**Palette first** — warm vs cool bias, saturation, contrast range. **Composition second** — is it ordered or expressive, sparse or layered. **Typography third** — does the hierarchy match Besley\'s warmth. **Synthesis last** — where does it align and where does it conflict with the "warm, crafted, human" positioning.',
      },
    ],
    thinkingSummary: 'I approached this as a structured brand audit rather than a subjective reaction. Breaking it into **palette, composition, and typography** lets me give specific, actionable feedback rather than a vague impression. The key tension I found: the monochrome references **lower the emotional temperature** of an otherwise warm moodboard.',
    activities: [
      { type: 'scan-image', detail: 'souvenir-moodboard-v2.png — loading image, mapping dimensions' },
      { type: 'scan-image', detail: 'analysing colour palette — temperature, saturation, contrast range' },
      { type: 'scan-image', detail: 'evaluating compositional structure — density, visual weight, layout logic' },
      { type: 'scan-image', detail: 'assessing typographic choices — hierarchy, family, emotional register' },
      { type: 'synthesise', detail: 'cross-referencing all dimensions against Souvenir brand values' },
    ],
    actionGroups: [],
    response: 'The moodboard is directionally right but has a tension worth resolving — and I can be specific about where.\n\n**Colour palette: 80% aligned.** The amber, ochre, and terracotta range is exactly right — warm, grounded, human. The problem is three images that lean high-contrast black-and-white. They pull the emotional temperature down and read as editorial rather than personal.\n\n**Composition: Aligned.** The mix of layered, imperfect, and tactile references matches Souvenir\'s "memory as it actually was" positioning. Nothing here feels too produced or generic.\n\n**Typography: Partially aligned.** The serif pairings in the bottom-right quadrant are strong — consistent with Besley\'s warmth. But two references use extended grotesks in a way that reads as tech-adjacent rather than craft-adjacent.\n\n**Recommendation:** Remove or soften the monochrome images — replace with more from the amber/terracotta register. The bottom-right quadrant is the strongest section and should dominate. Cut the grotesk-heavy typography references. The moodboard is 80% there.',
    researchTitle: 'Analysed moodboard across palette, composition, and typography',
  },

  // ── S6: Pins + deep reasoning ──────────────────────────────────────────────
  {
    id: 'S6', name: 'Pins + reasoning', description: 'Memory search + Adaptive Thinking — finding patterns in saves',
    userQuery: 'What have I been saving about distribution? What\'s the pattern across all of it?',
    attachment: { type: 'pin', name: 'Distribution strategy — saved articles' },
    hasActivities: true,
    activitiesFirst: true,
    reasoningSteps: [
      {
        verb: 'Considered', detail: 'what the saves reveal about Chai\'s underlying belief system',
        summary: 'Finding a pattern across saves is different from summarising them. **I\'m looking for the underlying theory Chai keeps returning to** — what they keep collecting about distribution is **a signal of what they actually believe**, even if they haven\'t written it explicitly.',
      },
      {
        verb: 'Synthesised', detail: 'the conceptual thread connecting all 12 saves',
        summary: 'Looking across the pins, there\'s a consistent theme: Chai keeps saving content about **organic compounding — word of mouth, retention-as-distribution, building-in-public.** Almost nothing saved is about **paid acquisition** or top-of-funnel media spend. **That\'s the pattern.**',
      },
    ],
    thinkingSummary: 'I read the pins not as a list to summarise, but **as evidence of a belief system.** The pattern that emerged: Chai is consistently drawn to **distribution strategies that compound from genuine user value** — retention-first, word-of-mouth, building in public. **There\'s almost nothing about paid channels.** This suggests a strong intuition about what kind of company Souvenir should be.',
    activities: [
      { type: 'read-pins', detail: 'scanning your pinboard — browsing all saved items', resultCount: 12,
        results: [
          { title: 'Andrew Chen — Cold Start Problem notes', domain: 'pin' },
          { title: 'Lenny\'s Newsletter — retention as distribution', domain: 'pin' },
          { title: 'Building in public — why it works', domain: 'pin' },
          { title: 'PMF signals: when word-of-mouth starts compounding', domain: 'pin' },
        ],
      },
      { type: 'read-pins', detail: 'filtering pins related to distribution and growth', resultCount: 8,
        results: [
          { title: 'Founder-led content thread by Jason Fried', domain: 'pin' },
          { title: 'Why most startup marketing fails immediately', domain: 'pin' },
          { title: 'YC application draft — traction section', domain: 'pin' },
        ],
      },
      { type: 'synthesise', detail: 'connecting the dots across all distribution saves' },
    ],
    actionGroups: [],
    response: 'You have 12 saves about distribution. Here\'s the pattern.\n\n**You don\'t believe in paid acquisition — at least not yet.** Not a single save is about media spend, performance marketing, or top-of-funnel channels. Everything you\'ve collected is about organic compounding.\n\n**The consistent thread:** Retention as distribution. You keep saving content that makes the same argument in different ways — that the only sustainable GTM is one where genuinely happy users do the distributing. Cold Start Problem, Lenny\'s newsletter, the building-in-public thread — they\'re all the same thesis.\n\n**What this tells you about Souvenir:** You already know what kind of company you want to build. You\'re not confused about distribution strategy — you\'re waiting for the product to be good enough that the strategy activates naturally. The question isn\'t "what channel" — it\'s "when is the product ready to deserve word-of-mouth?"',
    researchTitle: 'Found pattern across 12 distribution saves',
  },

  // ── S7: Notion connector ───────────────────────────────────────────────────
  {
    id: 'S7', name: 'Connector: Notion', description: 'Pulls live data from a connected Notion workspace',
    userQuery: 'Pull my sprint 2 notes from Notion and summarise what\'s still left to do',
    hasActivities: true,
    reasoningSteps: [],
    thinkingSummary: '',
    activities: [
      { type: 'connector-notion', badge: true, detail: 'Connecting to Notion — verifying workspace access' },
      { type: 'read-file', badge: true, detail: 'Listing pages in your Design workspace', resultCount: 6,
        results: [
          { title: 'Sprint 2 PRD', domain: 'notion' },
          { title: 'Design checklist — DS V1 components', domain: 'notion' },
          { title: 'Sprint 2 report (in progress)', domain: 'notion' },
          { title: 'Kaya DS component tracker', domain: 'notion' },
        ],
      },
      { type: 'read-file', detail: 'Sprint 2 PRD — reading goals, scope, key dates' },
      { type: 'read-file', detail: 'DS V1 component checklist — extracting status per component' },
      { type: 'read-file', detail: 'Sprint 2 report — checking what\'s already been logged' },
    ],
    actionGroups: [
      { activityCount: 2, summary: 'Connected. Found 6 pages in Design workspace.' },
      { activityCount: 3, summary: 'Read all sprint 2 documents. Identifying remaining work…' },
    ],
    response: 'From your Notion sprint 2 workspace, here\'s what\'s still open.\n\n## DS V1 — components not yet built\n\n- **`DatePicker`** — no Figma spec yet. This is the hardest blocker: Utkarsh can\'t start until the spec exists.\n- **`Toast`** — no spec. Used across 6+ flows. Needs variant table: success, warning, error, neutral.\n- **`Sheet`** — no spec. Required for the mobile connector auth overlay.\n- **`Command palette`** — no spec. Deferred from V1 is an option — check with Utkarsh if it\'s blocking.\n- **`Combobox`** and **`Stepper`** — both unassigned. Lower risk if revamp doesn\'t touch those flows.\n\nAll six were scoped for V1. None have been started. These are the single hardest blocker to the May 19 event.\n\n## Chat States — in progress\n\n### What\'s live\n\nB1 is complete and running at `localhost:3002/chat-preview`. The 9-phase animation sequence, model row, research panel, and streaming renderer are all done.\n\n### What\'s not started\n\n1. **B2–B5** — follow-up states, clarifying question overlay, connector auth failure, search timeout.\n2. **F1–F3** — follow-up bar, adaptive thinking dropdown, citation popover.\n3. **D1–D4 and E1–E2** — data output states and error states. None started.\n\n## Other open items\n\n> Sprint 2 report is due Apr 28 — that\'s 5 days away. Material is strong, it just needs to be written.\n\n**Brand audit** — no activity logged against the branding file, mood board, or illustration style. This was a sprint 2 secondary goal.\n\n**My recommendation:** Close the DS V1 spec gap first. Everything else is downstream.',
    researchTitle: 'Pulled and summarised Sprint 2 Notion workspace',
  },

  // ── S8: CSV + code analysis ────────────────────────────────────────────────
  {
    id: 'S8', name: 'Data: CSV + code', description: 'CSV attached — code execution, data analysis',
    userQuery: 'Here\'s my onboarding analytics export. Where are users dropping off?',
    attachment: { type: 'csv', name: 'onboarding-funnel-export.csv' },
    hasActivities: true,
    reasoningSteps: [
      {
        verb: 'Planned', detail: 'how to analyse a funnel CSV to find meaningful drop-off patterns',
        summary: 'I need to read the structure first, then look at absolute drop-off numbers, then calculate **relative conversion rates between each step.** Drop-off in absolute numbers can be misleading — **what matters is the step where the conversion rate falls most sharply**, not where the raw count is lowest.',
      },
    ],
    thinkingSummary: 'My approach: read the CSV structure first, then **calculate step-by-step conversion rates — not just absolute drop-offs** — then identify where the **sharpest relative decline** happens. **That\'s the real drop-off point**, not necessarily where the lowest number is.',
    activities: [
      { type: 'read-file', badge: true, detail: 'onboarding-funnel-export.csv — opening file, checking size' },
      { type: 'read-csv', badge: true, detail: 'Reading structure — identifying columns and event types' },
      { type: 'run-code', badge: true, detail: 'Parsing 2,847 rows — extracting onboarding step columns' },
      { type: 'run-code', badge: true, detail: 'Calculating step-by-step conversion rates' },
      { type: 'run-code', badge: true, detail: 'Identifying sharpest relative drop-off between steps' },
      { type: 'calculate', badge: true, detail: 'Computing statistical significance of drop-off deltas' },
    ],
    actionGroups: [
      { activityCount: 2, summary: 'File loaded and structured. Running analysis…' },
      { activityCount: 4, summary: 'Analysis complete. Preparing drop-off report…' },
    ],
    response: 'I analysed 2,847 onboarding sessions from your export. Here\'s where you\'re losing people.\n\n**The critical drop-off: Step 3 → Step 4** (Connecting first source → First pin saved)\n- 67% of users who reach step 3 do not complete step 4\n- This is your biggest single-step loss: ~1,200 users per cohort\n- Time-to-drop: median 43 seconds after reaching the connector screen\n\n**Secondary drop-off: Step 5 → Step 6** (First pin → First chat)\n- 44% drop-off — significant but smaller than the step 3→4 problem\n- Users who save 3+ pins in session 1 have a 78% completion rate to step 6\n\n**What the data suggests:** The connector step is asking for too much too fast. Users who see the "connect your apps" screen before they\'ve experienced any value are bailing. The fix isn\'t better copy — it\'s moving the connector step after the first "aha" moment.',
    researchTitle: 'Analysed onboarding funnel — found critical drop-off at step 3→4',
  },

  // ── S9: Mixed — Vision + Pins + Web ───────────────────────────────────────
  {
    id: 'S9', name: 'Mixed: Vision + Pins + Web', description: 'Image + pins + web search — cross-modal analysis',
    userQuery: 'I\'ve attached a screenshot of our onboarding screen. Cross-reference it with my design pins and find examples of better onboarding patterns.',
    attachment: { type: 'image', name: 'onboarding-screen-v3.png' },
    hasActivities: true,
    activitiesFirst: false,
    reasoningSteps: [
      {
        verb: 'Considered', detail: 'what cross-modal analysis means here — three very different sources',
        summary: 'This is an unusual request: **a screenshot, a pinboard, and the web all at once.** Each source tells a different kind of story. The screenshot is prescriptive — it shows what exists. The pins are aspirational — they show what Chai has been drawn to. The web is comparative — it shows what\'s out there. **I need to synthesise across all three, not treat them equally.**',
      },
      {
        verb: 'Strategized', detail: 'how to weight the three sources for a useful answer',
        summary: '**Screenshot first** — understand the current state before looking outward. **Pins second** — Chai\'s taste is the filter; anything that doesn\'t resonate with what they\'ve saved is irrelevant even if it\'s "best practice". **Web last** — use it to find patterns the pins already point toward. **Synthesis: what the current screen is missing that Chai already knows they want.**',
      },
    ],
    thinkingSummary: 'I treated this as a **taste-filtered research task** rather than a generic UX audit. Chai\'s saved pins are the filter — they define what "better" means specifically for Souvenir, not for onboarding in general. The web search was targeted at patterns the pins already pointed toward.',
    activities: [
      { type: 'scan-screenshot', detail: 'onboarding-screen-v3.png — analysing current layout and flow' },
      { type: 'read-pins', detail: 'scanning pins for onboarding, UX, and first-run experience', resultCount: 7,
        results: [
          { title: 'Onboarding flows that don\'t make you do homework', domain: 'pin' },
          { title: 'Linear\'s progressive disclosure — a case study', domain: 'pin' },
          { title: 'The empty state is an onboarding moment', domain: 'pin' },
        ],
      },
      { type: 'web-search', badge: true, detail: 'onboarding patterns 2026 progressive disclosure first-run UX',
        resultCount: 8,
        results: [
          { title: 'Progressive Disclosure in Onboarding — UX Patterns 2026', domain: 'nngroup.com' },
          { title: 'How Linear nails first-run experience without a product tour', domain: 'productled.com' },
          { title: 'The empty state is your best onboarding tool', domain: 'uxdesign.cc' },
        ],
      },
      { type: 'synthesise', detail: 'mapping current screen gaps against pin taste and web patterns' },
    ],
    actionGroups: [],
    response: 'Your current onboarding screen is doing too much in one moment — and your own pins tell you exactly what the alternative looks like.\n\n**What the screenshot shows:** Three distinct actions required before the user has experienced any value: connect an account, install the extension, and import existing notes. The cognitive load hits before the user has a reason to care.\n\n**What your pins point to:** You\'ve saved three pieces about the same idea — value before friction. Linear\'s onboarding, the "empty state is a moment" argument, and the progressive disclosure case study all make the same point: **show one thing, let it land, then ask for the next thing.**\n\n**What the web confirms:** The dominant 2026 pattern for successful B2C onboarding is a single, immediate "aha" moment in the first 90 seconds — then progressive setup. None of the top-performing flows ask for account connections in session 1.\n\n**Recommendation:** Restructure around one question: what\'s the fastest path to the first saved memory? Everything else — connectors, imports, settings — moves to a deferred setup flow that surfaces after the first value moment.',
    researchTitle: 'Cross-referenced onboarding screen with pins and web research',
  },

  // ── S10: Table — AI model comparison ──────────────────────────────────────
  {
    id: 'S10', name: 'Output: Table', description: 'Structured table — model comparison with staggered row reveal',
    userQuery: 'Compare Claude Sonnet 4.5, GPT-4o, and Gemini 2.0 Flash across key capabilities',
    hasActivities: true,
    reasoningSteps: [
      {
        verb: 'Considered', detail: 'what makes a fair, useful comparison framework',
        summary: 'Model comparisons usually devolve into cherry-picked benchmarks. **A fair framework needs dimensions that matter for actual usage** — not just leaderboard scores. I\'ll anchor on: speed, reasoning depth, coding quality, cost, context window, and what each model is genuinely best at.',
      },
      {
        verb: 'Planned', detail: 'which six dimensions to include and how to source current data',
        summary: 'Speed and cost require checking current pricing pages — these change often. **Reasoning and coding quality** I\'ll pull from 2026 benchmark aggregators (MMLU-Pro, HumanEval, GPQA). **"Best for" column** will be my synthesis, not a score — that\'s the most useful cell in the table.',
      },
    ],
    thinkingSummary: 'I chose six dimensions that matter for real usage rather than leaderboard vanity. **Speed and cost are live data** (checked current pages). Reasoning and coding come from 2026 benchmark aggregators. The "Best for" column is my synthesis — that\'s what turns a comparison into a decision.',
    activities: [
      { type: 'web-search', badge: true, detail: '2026 AI model benchmarks MMLU reasoning coding comparison',
        resultCount: 6, results: [
          { title: 'AI Model Leaderboard Q2 2026 — LMSYS & HuggingFace', domain: 'huggingface.co' },
          { title: 'HumanEval+ 2026 Rankings: Claude vs GPT-4o vs Gemini', domain: 'evalplus.github.io' },
          { title: 'Artificial Analysis — Speed and Cost Benchmarks May 2026', domain: 'artificialanalysis.ai' },
        ],
      },
      { type: 'web-search', badge: true, detail: 'Claude Sonnet GPT-4o Gemini Flash pricing context window 2026',
        resultCount: 4, results: [
          { title: 'Anthropic pricing — Claude Sonnet 4.5', domain: 'anthropic.com' },
          { title: 'OpenAI pricing — GPT-4o May 2026', domain: 'openai.com' },
          { title: 'Google AI pricing — Gemini 2.0 Flash', domain: 'ai.google.dev' },
        ],
      },
    ],
    actionGroups: [],
    response: '',
    researchTitle: 'Compared 3 models across 6 dimensions — May 2026',
    responseType: 'table',
    openUIData: {
      caption: 'Claude Sonnet 4.5 · GPT-4o · Gemini 2.0 Flash — May 2026',
      headers: ['Dimension', 'Claude Sonnet 4.5', 'GPT-4o', 'Gemini 2.0 Flash'],
      rows: [
        ['Speed',           '110 tok/s',       '85 tok/s',        '150 tok/s'],
        ['Reasoning',       '★★★★★',           '★★★★☆',           '★★★★☆'],
        ['Coding',          '★★★★★',           '★★★★★',           '★★★★☆'],
        ['Cost (1M tokens)', '$3 / $15',        '$2.5 / $10',      '$0.10 / $0.40'],
        ['Context window',  '200K',            '128K',            '1M'],
        ['Best for',        'Deep reasoning',  'Multimodal tasks', 'Speed + cost'],
      ],
      sortable: true,
      accentRows: [1], // Reasoning row — where Claude leads
    } as TableData,
  },

  // ── S11: Bar Chart — Response time analytics ───────────────────────────────
  {
    id: 'S11', name: 'Output: Bar chart', description: 'Structured bar chart — analytics with spring-growth bars',
    userQuery: 'Pull my analytics and show me average response times per model this week',
    hasActivities: true,
    reasoningSteps: [
      {
        verb: 'Planned', detail: 'how to calculate meaningful averages from raw session data',
        summary: '**Raw averages are misleading** — long "thinking" sessions skew mean response time. I\'ll use **median** response time per model, excluding sessions over 60s (likely idle tabs). Then filter to the last 7 days only, since you switched to Souvenir on Apr 17.',
      },
    ],
    thinkingSummary: 'I used **median** response time rather than mean to avoid skew from idle sessions. Filtered to last 7 days (since Apr 17 switch) and excluded sessions over 60s. The result is a clean picture of what you actually experienced, not what the outliers inflate.',
    activities: [
      { type: 'connector-notion', badge: true, detail: 'Connecting to analytics workspace — verifying access' },
      { type: 'read-csv', badge: true, detail: 'session-analytics-apr17-apr24.csv — 847 sessions loaded' },
      { type: 'run-code', badge: true, detail: 'Filtering to last 7 days, excluding idle sessions >60s' },
      { type: 'run-code', badge: true, detail: 'Calculating median response time per model across 847 sessions' },
    ],
    actionGroups: [
      { activityCount: 2, summary: 'Analytics connected and loaded. Running calculations…' },
      { activityCount: 2, summary: 'Calculations complete. Rendering chart…' },
    ],
    response: '',
    researchTitle: 'Calculated median response times — 847 sessions, Apr 17–24',
    responseType: 'bar-chart',
    openUIData: {
      title: 'Median response time by model — Apr 17–24',
      unit: 's',
      maxValue: 3.5,
      bars: [
        { label: 'Claude',   value: 2.1, color: '#524B47' },
        { label: 'GPT-4o',   value: 1.8, color: '#0D6EB2' },
        { label: 'Gemini',   value: 0.9, color: '#135487' },
        { label: 'Mistral',  value: 1.4, color: '#827A74' },
        { label: 'Sonar',    value: 1.2, color: '#3B3632' },
      ],
    } as BarChartData,
  },

  // ── S12: Steps — Notion connector setup ───────────────────────────────────
  {
    id: 'S12', name: 'Output: Steps', description: 'Structured steps — setup guide with progressive reveal',
    userQuery: 'Walk me through setting up the Notion connector in Souvenir step by step',
    hasActivities: true,
    reasoningSteps: [
      {
        verb: 'Considered', detail: 'the right level of detail for a connector setup guide',
        summary: 'Setup guides fail in two directions: **too sparse** (user gets stuck on the OAuth redirect) or **too granular** (user loses the thread). **The right level is: one step per decision point**, not one step per click. I\'ll anchor on the 5 moments where the user needs to make a choice or could get confused.',
      },
    ],
    thinkingSummary: 'I structured the guide around **decision points, not clicks** — the 5 moments where a user needs to choose something or could get confused. This avoids the 12-step screenshot tutorial problem while still covering the OAuth redirect and workspace selection which are the two most common failure points.',
    activities: [
      { type: 'connector-notion', badge: true, detail: 'Checking current workspace state — is Notion already connected?' },
      { type: 'read-file', detail: 'Notion connector docs — reading OAuth flow and permission requirements' },
    ],
    actionGroups: [],
    response: '',
    researchTitle: 'Mapped Notion connector setup — 5 decision points',
    responseType: 'steps',
    openUIData: {
      title: 'Connecting Notion to Souvenir',
      steps: [
        {
          label: 'Open Settings → Connectors',
          description: 'In Souvenir, tap your avatar → Settings → Connectors. You\'ll see all available integrations.',
        },
        {
          label: 'Click "Connect Notion"',
          description: 'You\'ll be redirected to Notion\'s OAuth page. This is Notion\'s own auth — Souvenir never sees your Notion password.',
        },
        {
          label: 'Select your workspace and grant access',
          description: 'Choose the workspace to connect. Souvenir requests read-only access by default — enough to index and search your pages.',
        },
        {
          label: 'Choose which databases to include',
          description: 'Back in Souvenir, pick which Notion databases to sync. You can always add or remove these later from Settings.',
        },
        {
          label: 'Run a test sync',
          description: 'Hit "Test connection" — Souvenir will import your first 50 pages. If it works, you\'re done. If not, check the workspace permissions from step 3.',
        },
      ],
    } as StepsData,
  },

  // ── S13: Mixed — Text + Table + Follow-ups ────────────────────────────────
  {
    id: 'S13', name: 'Mixed: Text + Table + Follow-ups', description: 'Mixed output — intro text, comparison table, follow-up prompts',
    userQuery: 'Which AI model should we use for each feature in Souvenir?',
    hasActivities: true,
    reasoningSteps: [
      {
        verb: 'Considered', detail: 'what "best for Souvenir" means across different feature types',
        summary: 'Souvenir has at least three distinct AI use cases: **chat and reasoning** (needs depth), **memory indexing** (needs speed + low cost at scale), and **multimodal input** (needs vision). The right model is different for each — there\'s no universal answer.',
      },
    ],
    thinkingSummary: 'I split the problem into three feature types and evaluated models against what each actually requires. **Cost efficiency is critical for indexing** since it runs on every save. **Reasoning quality defines the chat experience.** **Vision accuracy determines multimodal quality.**',
    activities: [
      { type: 'web-search', badge: true, detail: 'AI model benchmarks cost speed reasoning multimodal 2026',
        resultCount: 5, results: [
          { title: 'Artificial Analysis — Benchmark Leaderboard Q2 2026', domain: 'artificialanalysis.ai' },
          { title: 'LMSYS Chatbot Arena — Latest Rankings', domain: 'lmarena.ai' },
          { title: 'OpenRouter Model Pricing — May 2026', domain: 'openrouter.ai' },
        ],
      },
    ],
    actionGroups: [],
    response: '',
    researchTitle: 'Matched AI models to Souvenir feature types',
    responseBlocks: [
      {
        kind: 'text',
        content: '## Model selection by feature\n\nThe right model depends entirely on which part of Souvenir is calling it. Here\'s how I\'d assign them across five feature areas:',
      },
      {
        kind: 'table',
        data: {
          headers: ['Feature', 'Recommended', 'Why', 'Fallback'],
          rows: [
            ['Chat + reasoning',    'Claude Sonnet 4.5', 'Best reasoning depth for complex queries', 'GPT-4o'],
            ['Memory indexing',     'Gemini 2.0 Flash',  'Fastest + cheapest at scale',             'Mistral Large'],
            ['Multimodal (image)',  'GPT-4o',            'Strongest vision + structured output',    'Claude Sonnet 4.5'],
            ['Pin search (RAG)',    'Sonar Large',        'RAG-native, built for retrieval',         'Gemini Flash'],
            ['Code execution',     'Claude Sonnet 4.5',  'Best code understanding + explanation',   'GPT-4o'],
          ],
          sortable: true,
        } as TableData,
      },
      {
        kind: 'follow-ups',
        data: {
          prompts: [
            'How much would Gemini Flash indexing cost at 10,000 pins/month?',
            'Can we use one unified model and avoid routing complexity?',
            'What\'s the latency difference between Sonnet and GPT-4o for chat?',
          ],
        },
      },
    ] as ResponseBlock[],
  },

  // ── S14: Mixed — Text + Callout + Tags ────────────────────────────────────
  {
    id: 'S14', name: 'Mixed: Text + Callout + Tags', description: 'Risk analysis — text overview, warning callout, risk category tags',
    userQuery: 'What are the biggest risks to our June 1 launch timeline?',
    hasActivities: true,
    reasoningSteps: [
      {
        verb: 'Mapped', detail: 'all dependencies blocking the June 1 date',
        summary: '**June 1 is 5 weeks away.** Working backward: Utkarsh needs the DS handoff to start the revamp; revamp takes ~3 weeks. **Handoff must ship by May 11 at the latest.** That\'s the single point of failure everything else flows from.',
      },
    ],
    thinkingSummary: 'I worked backward from June 1 to find the critical path. The DS handoff date is the bottleneck — everything else (revamp, QA, soft launch) is downstream. Two soft dependencies can run in parallel: branding and the first user batch.',
    activities: [
      { type: 'read-pins', detail: 'scanning pins for sprint planning, launch prep', resultCount: 4, results: [
        { title: 'June 1 launch plan — internal doc', domain: 'pin' },
        { title: 'DS V1 component tracker', domain: 'pin' },
      ]},
    ],
    actionGroups: [],
    response: '',
    researchTitle: 'Mapped risks to June 1 launch timeline',
    responseBlocks: [
      {
        kind: 'text',
        content: '## Three risk categories\n\nOne is critical and time-boxed, two are manageable. **Overall:** the timeline is achievable, but there\'s no slack in the critical path. One slipped DS component cascades directly to the launch date.',
      },
      {
        kind: 'card',
        data: {
          badge: '🔴 Critical',
          title: 'DS handoff must ship by May 11',
          subtitle: 'Blocks everything downstream',
          body: 'Utkarsh needs the full Kaya DS V1 handoff to start the revamp. Revamp takes ~3 weeks. **If this slips past May 11, June 1 is unreachable** — no buffer exists.',
        },
      },
      {
        kind: 'card',
        data: {
          badge: '🟡 Watch',
          title: 'Revamp scope creep',
          subtitle: 'Manageable with clear cut-line',
          body: 'The revamp can expand if components aren\'t locked. **Cut-line rule:** anything not in the Figma handoff doc by Apr 30 is V2. No exceptions.',
        },
      },
      {
        kind: 'callout',
        data: {
          variant: 'warning',
          title: 'May 11 is the single point of failure',
          body: 'Every component not specced by Apr 30 is a direct risk to the launch date. **Sprint 2 report (Apr 28) is your last forcing function** before the handoff window closes.',
        },
      },
      {
        kind: 'tags',
        data: {
          title: 'Risk categories',
          tags: [
            { label: 'DS handoff timing', color: '#C8920A' },
            { label: 'Revamp scope creep' },
            { label: 'Branding delay (non-blocking)', color: '#0D6EB2' },
            { label: 'First user batch', color: '#80B707' },
            { label: 'Sprint 2 report due Apr 28' },
          ],
        },
      },
    ] as ResponseBlock[],
  },

  // ── S15: Mixed — Code + Text ──────────────────────────────────────────────
  {
    id: 'S15', name: 'Mixed: Code + Text', description: 'API walkthrough — code block with line-by-line reveal + explanation',
    userQuery: 'Show me how to use the Souvenir API to save a pin programmatically',
    hasActivities: true,
    reasoningSteps: [],
    thinkingSummary: '',
    activities: [
      { type: 'read-file', badge: true, detail: 'souvenir-api-docs.md — checking SDK methods and auth flow' },
      { type: 'read-file', detail: 'sdk/pins.ts — reading pins.create interface signature' },
    ],
    actionGroups: [],
    response: '',
    researchTitle: 'Read Souvenir SDK docs — pins.create method',
    responseBlocks: [
      {
        kind: 'code',
        data: {
          language: 'typescript',
          caption: 'Full Souvenir SDK integration — pins, search, and error handling',
          code: `import { Souvenir, SouvenirError } from '@souvenir-ai/sdk'

// ── Client setup ──────────────────────────────────────────
const client = new Souvenir({
  apiKey: process.env.SOUVENIR_API_KEY,
  // Optional: override base URL for self-hosted instances
  baseUrl: process.env.SOUVENIR_BASE_URL,
})

// ── Save a pin ────────────────────────────────────────────
async function savePin() {
  const pin = await client.pins.create({
    title: 'AI benchmark report — Q2 2026',
    url: 'https://artificialanalysis.ai/models',
    content: 'Claude Sonnet leads reasoning. Gemini Flash is cheapest at scale.',
    tags: ['ai', 'benchmarks', 'research'],
    source: 'api',
  })

  console.log('Pin saved:', pin.id)
  // → 'pin_8f3a2c9d'
  return pin
}

// ── Search pins by query ──────────────────────────────────
async function searchPins(query: string) {
  const results = await client.pins.search({
    q: query,
    limit: 10,
    filters: { tags: ['research'] },
  })

  return results.items.map(pin => ({
    id: pin.id,
    title: pin.title,
    score: pin.relevanceScore,
  }))
}

// ── Error handling ────────────────────────────────────────
async function safeSave(data: Parameters<typeof client.pins.create>[0]) {
  try {
    return await client.pins.create(data)
  } catch (err) {
    if (err instanceof SouvenirError) {
      if (err.code === 'RATE_LIMITED') {
        console.warn('Rate limited — retry after:', err.retryAfter)
      } else if (err.code === 'DUPLICATE_URL') {
        console.warn('Pin already exists for this URL')
      } else {
        throw err
      }
    }
    return null
  }
}`,
        },
      },
      {
        kind: 'text',
        content: 'The `pins.create` call is the core operation. Three things to know:\n\n**Authentication:** The API key is per-user — never use a shared key in a multi-user context. Each user gets their own from Settings → Developer.\n\n**Content field:** This is what Souvenir indexes for memory search. The richer and more specific this is, the better the recall quality when chatting later.\n\n**Source field:** Groups pins by origin in the UI. Standard values are `api`, `browser-extension`, `mobile`, and `import`.',
      },
    ] as ResponseBlock[],
  },

  // ── S16: Mixed — Text + Pie chart + Follow-ups ────────────────────────────
  {
    id: 'S16', name: 'Mixed: Text + Pie chart + Follow-ups', description: 'Sprint time breakdown — text summary, animated pie chart, follow-up prompts',
    userQuery: "Break down how I'm spending time across different areas this sprint",
    hasActivities: true,
    reasoningSteps: [
      {
        verb: 'Planned', detail: 'how to categorise sprint time into meaningful buckets',
        summary: 'Raw time tracking is noise — I need to **group logged tasks into 4–5 categories** that match how Chai actually thinks about the sprint. ClickUp tasks + Notion entries give raw data; the categorisation is my interpretation pass.',
      },
    ],
    thinkingSummary: 'I grouped ClickUp time entries and Notion sprint logs into 5 categories reflecting how Chai actually thinks about the sprint: design, coordination, research, learning (Claude course), and other. The categorisation is my synthesis, not raw ClickUp tags.',
    activities: [
      { type: 'connector-notion', badge: true, detail: 'Pulling Sprint 2 time entries from ClickUp + Notion logs' },
      { type: 'run-code', badge: true, detail: 'Parsing 47 task entries — grouping by category, summing hours' },
    ],
    actionGroups: [
      { activityCount: 2, summary: 'Time data pulled and categorised. Building breakdown…' },
    ],
    response: '',
    researchTitle: 'Analysed sprint time — 47 tasks across 5 categories',
    responseBlocks: [
      {
        kind: 'text',
        content: "You've logged 38 hours across Sprint 2 so far (Apr 14–24). Design is the dominant category — right for this sprint. Coordination overhead at 18% is worth watching; it's eating into deep work time.",
      },
      {
        kind: 'pie-chart',
        data: {
          title: 'Sprint 2 time breakdown — Apr 14–24',
          unit: 'hrs',
          centerLabel: '38h',
          segments: [
            { label: 'Design (DS + Figma)', value: 42 },
            { label: 'Coordination + comms', value: 18, color: '#9C938B' },
            { label: 'Research + reading',  value: 16, color: '#0D6EB2' },
            { label: 'Claude course',       value: 14, color: '#80B707' },
            { label: 'Other',               value: 10, color: '#C0B5AD' },
          ],
        } as PieChartData,
      },
      {
        kind: 'follow-ups',
        data: {
          prompts: [
            'What specific tasks are in the coordination category?',
            'How does this compare to Sprint 1\'s time breakdown?',
            'Am I on track for the DS V1 handoff by May 11?',
          ],
        },
      },
    ] as ResponseBlock[],
  },

  // ── S17: Mixed — Line chart + Text ────────────────────────────────────────
  {
    id: 'S17', name: 'Mixed: Line chart + Text', description: 'Trend analysis — animated line chart with SVG path draw + insight',
    userQuery: 'Show me how my daily pin saves have trended over the last 30 days',
    hasActivities: true,
    reasoningSteps: [],
    thinkingSummary: '',
    activities: [
      { type: 'connector-notion', badge: true, detail: 'Connecting to Souvenir analytics — pulling pin save events' },
      { type: 'run-code', badge: true, detail: 'Aggregating daily pin counts — Mar 25 to Apr 24, 2026' },
    ],
    actionGroups: [
      { activityCount: 2, summary: 'Analytics pulled. Rendering 30-day trend…' },
    ],
    response: '',
    researchTitle: 'Charted 30-day pin save trend — Mar 25 to Apr 24',
    responseBlocks: [
      {
        kind: 'line-chart',
        data: {
          title: 'Daily pins saved — Mar 25 to Apr 24',
          lines: [
            {
              label: 'Pins saved',
              color: '#683D1B',
              points: [
                { x: 'Mar 25', y: 3 },  { x: 'Mar 26', y: 5 },  { x: 'Mar 27', y: 2 },
                { x: 'Mar 28', y: 8 },  { x: 'Mar 29', y: 4 },  { x: 'Mar 30', y: 1 },
                { x: 'Mar 31', y: 2 },  { x: 'Apr 1',  y: 6 },  { x: 'Apr 2',  y: 9 },
                { x: 'Apr 3',  y: 7 },  { x: 'Apr 4',  y: 4 },  { x: 'Apr 5',  y: 3 },
                { x: 'Apr 6',  y: 5 },  { x: 'Apr 7',  y: 11 }, { x: 'Apr 8',  y: 8 },
                { x: 'Apr 9',  y: 6 },  { x: 'Apr 10', y: 14 }, { x: 'Apr 11', y: 12 },
                { x: 'Apr 12', y: 9 },  { x: 'Apr 13', y: 7 },  { x: 'Apr 14', y: 16 },
                { x: 'Apr 15', y: 13 }, { x: 'Apr 16', y: 11 }, { x: 'Apr 17', y: 18 },
                { x: 'Apr 18', y: 15 }, { x: 'Apr 19', y: 12 }, { x: 'Apr 20', y: 9 },
                { x: 'Apr 21', y: 14 }, { x: 'Apr 22', y: 17 }, { x: 'Apr 23', y: 19 },
                { x: 'Apr 24', y: 22 },
              ],
            },
          ],
        } as LineChartData,
      },
      {
        kind: 'text',
        content: 'Your pin save rate has been **accelerating**. The 30-day average is 8.6 pins/day, but the last 7 days average 15.7 — nearly 2× the baseline.\n\nThe spike on Apr 14 corresponds to the sprint start. **Sprints are your best research moments** — you save more when you have a clear goal to collect toward.',
      },
    ] as ResponseBlock[],
  },

  // ── E1: Connector auth failure — Gmail expired ─────────────────────────────
  {
    id: 'E1', name: 'E1 · Connector auth failure', description: 'Gmail auth expired mid-response — inline error with reconnect CTA',
    userQuery: 'What emails did I get from investors this week?',
    hasActivities: true,
    reasoningSteps: [],
    thinkingSummary: '',
    activities: [
      {
        type: 'web-search', badge: false,
        detail: 'investor emails this week',
        resultCount: 0,
        results: [],
      },
    ],
    actionGroups: [],
    researchTitle: 'Checking your Gmail for investor threads',
    response: '',
    responseBlocks: [
      {
        kind: 'text',
        content: 'I found a few threads that look relevant based on subject lines and sender names Souvenir has seen before.\n\n**From your recent activity, these senders appeared in pin notes:**\n- Sequoia Scout Program — follow-up thread flagged in your Apr 12 note\n- Asha @ Accel India — you pinned her LinkedIn post last week\n- YC Group Partner reply — marked important in your Apr 9 save',
      },
      {
        kind: 'connector-error',
        data: {
          connector: 'Gmail',
          icon: '✉️',
          message: 'Your Gmail connection has expired.',
          cta: 'Reconnect Gmail',
        },
      },
      {
        kind: 'text',
        content: 'To get the full thread content and any new emails not yet pinned, reconnect Gmail above. In the meantime, your pin notes from those senders are in the Research panel.',
      },
    ] as ResponseBlock[],
  },

  // ── E2: Web search timeout ─────────────────────────────────────────────────
  {
    id: 'E2', name: 'E2 · Search timeout', description: 'Web search timed out mid-response — inline error with retry CTA',
    userQuery: 'What\'s the latest on Anthropic\'s valuation and funding round?',
    hasActivities: true,
    reasoningSteps: [],
    thinkingSummary: '',
    activities: [
      {
        type: 'web-search', badge: true,
        detail: 'Anthropic valuation funding round 2026',
        resultCount: 0,
        results: [],
      },
    ],
    actionGroups: [],
    researchTitle: 'Searching for Anthropic funding news',
    response: '',
    responseBlocks: [
      {
        kind: 'text',
        content: 'Based on what I know up to my training cutoff, Anthropic raised at a **$18.4B valuation** in a Series E led by Google in early 2024, bringing total funding to approximately $7.3B.',
      },
      {
        kind: 'search-timeout',
        data: {
          query: 'Anthropic valuation funding round 2026',
          message: '',
          cta: 'Retry search',
        },
      },
      {
        kind: 'text',
        content: 'You have a pin from Mar 2026 titled **"Anthropic funding tracker"** that may have newer numbers. Want me to pull that?',
      },
    ] as ResponseBlock[],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  S10 Table showcase variants — 9 distinct table types
// ─────────────────────────────────────────────────────────────────────────────
const TABLE_VARIANTS: Record<string, { label: string; description: string; data: TableData }> = {
  basic: {
    label: 'Basic', description: 'Simple sortable model comparison',
    data: {
      caption: 'Claude Sonnet 4.5 · GPT-4o · Gemini 2.0 Flash — May 2026',
      variant: 'basic',
      sortable: true,
      headers: ['Dimension', 'Claude Sonnet 4.5', 'GPT-4o', 'Gemini 2.0 Flash'],
      rows: [
        ['Speed',            '110 tok/s',       '85 tok/s',         '150 tok/s'],
        ['Reasoning',        '★★★★★',           '★★★★☆',            '★★★★☆'],
        ['Coding',           '★★★★★',           '★★★★★',            '★★★★☆'],
        ['Cost (1M tokens)', '$3 / $15',         '$2.5 / $10',       '$0.10 / $0.40'],
        ['Context window',   '200K',             '128K',             '1M'],
        ['Best for',         'Deep reasoning',   'Multimodal tasks', 'Speed + cost'],
      ],
      accentRows: [1],
    },
  },
  striped: {
    label: 'Striped', description: 'Alternating row backgrounds for dense data',
    data: {
      variant: 'striped',
      sortable: true,
      headers: ['Model', 'MMLU-Pro', 'HumanEval+', 'GPQA', 'MT-Bench', 'Arena Elo'],
      rows: [
        ['Claude Sonnet 4.5', '89.4', '92.1', '71.3', '9.4', '1312'],
        ['GPT-4o',            '87.2', '90.6', '68.9', '9.2', '1287'],
        ['Gemini 2.0 Pro',    '85.8', '88.3', '66.1', '9.0', '1261'],
        ['Mistral Large',     '81.6', '83.4', '59.7', '8.6', '1198'],
        ['DeepSeek-V3',       '83.2', '86.1', '61.4', '8.8', '1215'],
        ['Llama 3.1 405B',    '78.4', '79.2', '56.3', '8.3', '1163'],
        ['Gemini Flash 2.0',  '76.1', '77.8', '54.2', '8.1', '1144'],
      ],
    },
  },
  compact: {
    label: 'Compact', description: 'Dense analytics — tight row height',
    data: {
      variant: 'compact',
      headers: ['Endpoint', 'P50', 'P95', 'P99', 'Req/min', 'Error %'],
      rows: [
        ['/api/pins/create',   '42ms',  '118ms', '290ms', '1,240', '0.12%'],
        ['/api/chat/stream',   '89ms',  '342ms', '780ms', '680',   '0.08%'],
        ['/api/search',        '31ms',  '96ms',  '201ms', '2,100', '0.04%'],
        ['/api/pins/list',     '18ms',  '54ms',  '112ms', '3,400', '0.01%'],
        ['/api/connectors',    '156ms', '490ms', '940ms', '320',   '0.31%'],
        ['/api/memory/index',  '220ms', '680ms', '1.2s',  '180',   '0.18%'],
        ['/api/auth/refresh',  '12ms',  '38ms',  '76ms',  '5,600', '0.00%'],
        ['/api/export/csv',    '344ms', '980ms', '2.1s',  '90',    '0.42%'],
      ],
    },
  },
  badges: {
    label: 'Badges', description: 'Status cells with colored pill badges',
    data: {
      variant: 'badges',
      headers: ['Metric', 'Sprint 1', 'Sprint 2', 'Sprint 3', 'Trend'],
      badgeMap: {
        'A':  { color: '#166534', bg: 'rgba(22,101,52,0.1)',    border: 'rgba(22,101,52,0.2)' },
        'A+': { color: '#166534', bg: 'rgba(22,101,52,0.15)',   border: 'rgba(22,101,52,0.25)' },
        'B+': { color: '#0D6EB2', bg: 'rgba(13,110,178,0.08)', border: 'rgba(13,110,178,0.18)' },
        'B':  { color: '#0D6EB2', bg: 'rgba(13,110,178,0.06)', border: 'rgba(13,110,178,0.14)' },
        'B-': { color: '#6B4A08', bg: 'rgba(200,146,10,0.08)', border: 'rgba(200,146,10,0.18)' },
        'C+': { color: '#7C1D1D', bg: 'rgba(200,50,50,0.07)',  border: 'rgba(200,50,50,0.16)' },
        '↑':  { color: '#166534', bg: 'rgba(22,101,52,0.08)',  border: 'rgba(22,101,52,0.15)' },
        '↓':  { color: '#7C1D1D', bg: 'rgba(200,50,50,0.07)', border: 'rgba(200,50,50,0.15)' },
        '→':  { color: '#524B47', bg: 'rgba(59,54,50,0.07)',   border: 'rgba(59,54,50,0.14)' },
      },
      rows: [
        ['Retention D7',   'B-',  'B',   'B+',  '↑'],
        ['Activation rate','C+',  'B-',  'B',   '↑'],
        ['NPS',            'B',   'B+',  'A',   '↑'],
        ['Churn rate',     'B-',  'B-',  'B',   '↑'],
        ['Feature adoption','C+', 'B',   'B+',  '↑'],
        ['Support tickets','A',   'A',   'A+',  '→'],
        ['Time to value',  'B',   'B+',  'A',   '↑'],
      ],
    },
  },
  financial: {
    label: 'Financial', description: 'Right-aligned numbers, bold totals row',
    data: {
      variant: 'financial',
      totalsRow: true,
      headers: ['Category', 'Budget', 'Spent', 'Remaining', '% Used'],
      rows: [
        ['Engineering',       '$48,000',  '$41,200', '$6,800',  '85.8%'],
        ['Design tools',      '$4,800',   '$3,960',  '$840',    '82.5%'],
        ['Infrastructure',    '$12,000',  '$9,840',  '$2,160',  '82.0%'],
        ['Marketing',         '$8,400',   '$5,110',  '$3,290',  '60.8%'],
        ['Research & events', '$6,000',   '$2,780',  '$3,220',  '46.3%'],
        ['Legal & compliance','$3,600',   '$3,600',  '$0',      '100%'],
        ['Total',             '$82,800',  '$66,490', '$16,310', '80.3%'],
      ],
      accentRows: [5],
    },
  },
  hoverable: {
    label: 'Hoverable', description: 'Row highlights on hover, no vertical dividers',
    data: {
      variant: 'hoverable',
      headers: ['Component', 'Status', 'Storybook', 'Figma', 'Last updated'],
      rows: [
        ['Button',            'Stable',    '✓ Done',     '✓ Done', 'Apr 22'],
        ['IconButton',        'Stable',    '✓ Done',     '✓ Done', 'Apr 20'],
        ['ChatInput',         'Stable',    '✓ Done',     '✓ Done', 'Apr 23'],
        ['Sidebar',           'In review', 'In progress','✓ Done', 'Apr 21'],
        ['ModelSelectItem',   'Stable',    '✓ Done',     '✓ Done', 'Apr 19'],
        ['ResearchBlock',     'Prototype', 'Pending',    '✓ Done', 'Apr 24'],
        ['DropdownMenu',      'Stable',    '✓ Done',     '✓ Done', 'Apr 18'],
        ['FloatingMenu',      'In review', 'In progress','✓ Done', 'Apr 16'],
        ['ChipButton',        'Stable',    '✓ Done',     '✓ Done', 'Apr 14'],
      ],
    },
  },
  minimal: {
    label: 'Minimal', description: 'No vertical borders, thin horizontal dividers',
    data: {
      variant: 'minimal',
      headers: ['Title', 'Author', 'Date', 'Tags'],
      rows: [
        ['How Linear nails first-run UX',          'Lenny Rachitsky', 'Apr 18',  'onboarding, UX'],
        ['The empty state is an onboarding tool',  'uxdesign.cc',     'Apr 16',  'UX, design'],
        ['Progressive disclosure — a case study',  'Nielsen Norman',  'Apr 14',  'UX patterns'],
        ['AI benchmark report Q2 2026',            'Artificial Analysis','Apr 22','AI, benchmarks'],
        ['Building trust before asking for data',  'First Round',     'Apr 20',  'product, trust'],
        ['Memory as competitive moat',             'Benedict Evans',  'Apr 17',  'strategy, AI'],
        ['Designing for recall, not search',       'Figma Blog',      'Apr 15',  'design, memory'],
      ],
    },
  },
  'feature-comparison': {
    label: 'Feature matrix', description: 'Feature rows with ✓ / — check cells',
    data: {
      variant: 'feature-comparison',
      headers: ['Feature', 'Free', 'Pro', 'Team', 'Enterprise'],
      rows: [
        ['Pin saves',              '100/mo',   'Unlimited',  'Unlimited',  'Unlimited'],
        ['AI chat',                { type: 'check', value: true },  { type: 'check', value: true }, { type: 'check', value: true }, { type: 'check', value: true }],
        ['Adaptive Thinking',      { type: 'check', value: false }, { type: 'check', value: true }, { type: 'check', value: true }, { type: 'check', value: true }],
        ['Web connectors',         { type: 'check', value: false }, { type: 'check', value: true }, { type: 'check', value: true }, { type: 'check', value: true }],
        ['Team shared memory',     { type: 'check', value: false }, { type: 'check', value: false },{ type: 'check', value: true }, { type: 'check', value: true }],
        ['Custom AI model routing',{ type: 'check', value: false }, { type: 'check', value: false },{ type: 'check', value: false },{ type: 'check', value: true }],
        ['SSO + SAML',             { type: 'check', value: false }, { type: 'check', value: false },{ type: 'check', value: false },{ type: 'check', value: true }],
        ['API access',             { type: 'check', value: false }, { type: 'check', value: true }, { type: 'check', value: true }, { type: 'check', value: true }],
        ['Priority support',       { type: 'check', value: false }, { type: 'check', value: true }, { type: 'check', value: true }, { type: 'check', value: true }],
      ],
    },
  },
  'mixed-content': {
    label: 'Rich cells', description: 'Cells with title + subtitle + badge',
    data: {
      variant: 'mixed-content',
      headers: ['Person', 'Role', 'Focus', 'Status'],
      rows: [
        [
          { type: 'rich', text: 'Chai', sub: 'chai.design@cca.edu', badge: { label: 'Co-founder', color: '#683D1B', bg: 'rgba(104,61,27,0.08)' } },
          'Product design',
          { type: 'rich', text: 'DS V1 + Figma specs', sub: 'Sprint 2 primary' },
          { type: 'badge', label: 'Active', color: '#166534', bg: 'rgba(22,101,52,0.09)', border: 'rgba(22,101,52,0.18)' },
        ],
        [
          { type: 'rich', text: 'Utkarsh', sub: 'utkarsh@souvenir.ai', badge: { label: 'Eng lead', color: '#0D6EB2', bg: 'rgba(13,110,178,0.07)' } },
          'Frontend',
          { type: 'rich', text: 'Storybook + revamp', sub: 'Waiting on DS handoff' },
          { type: 'badge', label: 'Blocked', color: '#7C1D1D', bg: 'rgba(200,50,50,0.07)', border: 'rgba(200,50,50,0.16)' },
        ],
        [
          { type: 'rich', text: 'Avnish', sub: 'avnish@souvenir.ai', badge: { label: 'Design', color: '#524B47', bg: 'rgba(59,54,50,0.07)' } },
          'Visual design',
          { type: 'rich', text: 'Branding + illustrations', sub: 'Parallel track' },
          { type: 'badge', label: 'Active', color: '#166534', bg: 'rgba(22,101,52,0.09)', border: 'rgba(22,101,52,0.18)' },
        ],
        [
          { type: 'rich', text: 'Harsh', sub: 'harsh@souvenir.ai', badge: { label: 'Research', color: '#6B4A08', bg: 'rgba(200,146,10,0.07)' } },
          'Research',
          { type: 'rich', text: 'User interviews + GTM', sub: '3 sessions this week' },
          { type: 'badge', label: 'Active', color: '#166534', bg: 'rgba(22,101,52,0.09)', border: 'rgba(22,101,52,0.18)' },
        ],
        [
          { type: 'rich', text: 'Jai', sub: 'jai@souvenir.ai', badge: { label: 'Video', color: '#524B47', bg: 'rgba(59,54,50,0.07)' } },
          'Content',
          { type: 'rich', text: 'Demo video + launch reel', sub: 'Pre-launch track' },
          { type: 'badge', label: 'On hold', color: '#524B47', bg: 'rgba(59,54,50,0.07)', border: 'rgba(59,54,50,0.14)' },
        ],
      ] as TableCellValue[][],
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
//  S11 Bar chart showcase variants — 6 distinct chart types
// ─────────────────────────────────────────────────────────────────────────────
const CHART_VARIANTS: Record<string, { label: string; description: string; data: BarChartData }> = {
  vertical: {
    label: 'Vertical', description: 'Classic vertical bars — median response times',
    data: {
      title: 'Median response time by model — Apr 17–24',
      unit: 's',
      variant: 'vertical',
      maxValue: 3.5,
      bars: [
        { label: 'Claude',   value: 2.1, color: '#524B47' },
        { label: 'GPT-4o',   value: 1.8, color: '#0D6EB2' },
        { label: 'Gemini',   value: 0.9, color: '#135487' },
        { label: 'Mistral',  value: 1.4, color: '#827A74' },
        { label: 'Sonar',    value: 1.2, color: '#3B3632' },
      ],
    },
  },
  horizontal: {
    label: 'Horizontal', description: 'Horizontal bars — category comparison growing left-to-right',
    data: {
      title: 'Time spent per category — Sprint 2 (hrs)',
      unit: 'h',
      variant: 'horizontal',
      bars: [
        { label: 'Design (DS + Figma)',    value: 16, color: '#683D1B' },
        { label: 'Coordination + comms',   value: 7,  color: '#9C938B' },
        { label: 'Research + reading',     value: 6,  color: '#0D6EB2' },
        { label: 'Claude course',          value: 5,  color: '#80B707' },
        { label: 'Other',                  value: 4,  color: '#C0B5AD' },
      ],
    },
  },
  grouped: {
    label: 'Grouped', description: 'Multi-dataset side-by-side comparison',
    data: {
      title: 'Weekly active users by platform — last 4 weeks',
      unit: '',
      variant: 'grouped',
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      datasets: [
        { label: 'Web',     color: '#683D1B', values: [420, 510, 490, 640] },
        { label: 'Mobile',  color: '#0D6EB2', values: [180, 220, 310, 390] },
        { label: 'API',     color: '#80B707', values: [60,  90,  130, 190] },
      ],
      bars: [],
    },
  },
  stacked: {
    label: 'Stacked', description: 'Absolute stacked values — composition view',
    data: {
      title: 'Pins saved by source — last 4 weeks',
      unit: '',
      variant: 'stacked',
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      datasets: [
        { label: 'Extension', color: '#683D1B', values: [84, 102, 118, 143] },
        { label: 'Mobile',    color: '#9C938B', values: [36, 48,  61,  82]  },
        { label: 'API',       color: '#0D6EB2', values: [12, 18,  26,  41]  },
        { label: 'Import',    color: '#C0B5AD', values: [24, 19,  14,  8]   },
      ],
      bars: [],
    },
  },
  'stacked-100': {
    label: '100% Stacked', description: 'Normalized to 100% — proportion view',
    data: {
      title: 'Revenue mix by tier — Q1 2026',
      unit: '%',
      variant: 'stacked-100',
      labels: ['Jan', 'Feb', 'Mar'],
      datasets: [
        { label: 'Enterprise', color: '#26211E', values: [18, 22, 31] },
        { label: 'Team',       color: '#524B47', values: [24, 28, 34] },
        { label: 'Pro',        color: '#9C938B', values: [38, 33, 27] },
        { label: 'Free (conv)',color: '#C0B5AD', values: [20, 17, 8]  },
      ],
      bars: [],
    },
  },
  'positive-negative': {
    label: '+/− Diverging', description: 'Positive and negative values on shared baseline',
    data: {
      title: 'Net promoter score by cohort',
      unit: '',
      variant: 'positive-negative',
      bars: [
        { label: 'Week 1', value: -12, color: '#C83232' },
        { label: 'Week 2', value: -4,  color: '#C87B32' },
        { label: 'Week 3', value: 8,   color: '#80B707' },
        { label: 'Week 4', value: 21,  color: '#166534' },
        { label: 'Week 5', value: 34,  color: '#166534' },
        { label: 'Week 6', value: 28,  color: '#166534' },
      ],
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
//  Small components
// ─────────────────────────────────────────────────────────────────────────────
function BreathingDot() {
  return (
    <motion.span
      animate={{ opacity: [0.15, 1, 0.15] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
        background: '#826B60', verticalAlign: 'middle', marginLeft: 4,
      }}
    />
  )
}

function ActionBadge() {
  return (
    <span style={{
      fontSize: 9, fontWeight: 600, color: '#6A625D', letterSpacing: '0.4px',
      background: 'rgba(59,54,50,0.08)', borderRadius: 4,
      padding: '1px 5px', flexShrink: 0, textTransform: 'uppercase',
    }}>
      Action
    </span>
  )
}

function Chevron({ isOpen }: { isOpen: boolean }) {
  return (
    <motion.svg width="14" height="14" viewBox="0 0 14 14" fill="none"
      animate={{ rotate: isOpen ? 180 : 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      style={{ display: 'block', flexShrink: 0 }}>
      <path d="M3 5.5 L7 9.5 L11 5.5" stroke="var(--neutral-400)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </motion.svg>
  )
}

function ActivityIcon({ type, isDone }: { type: ActivityType; isDone: boolean }) {
  const { icon, isHuge } = ACTIVITY_ICON[type]
  const color = isDone ? '#80B707' : '#827A74'
  if (isHuge) return <HIcon icon={icon} size={16} color={color} strokeWidth={1.5} />
  // @strange-huge icons use size prop directly
  const Icon = icon
  return <Icon size={16} color={color} />
}

// File chip — for input and user bubble
function FileChip({ attachment }: { attachment: { type: 'pdf' | 'image' | 'csv' | 'pin'; name: string }; }) {
  if (attachment.type === 'pin') {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: 'rgba(104,61,27,0.08)', border: '1px solid rgba(104,61,27,0.18)',
        borderRadius: 8, padding: '4px 8px', maxWidth: 240,
      }}>
        <HIcon icon={Bookmark01Icon} size={12} color="#683D1B" strokeWidth={1.5} />
        <span style={{ fontSize: 11, color: '#683D1B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
          {attachment.name}
        </span>
        <span style={{ fontSize: 10, color: '#B6ACA4', flexShrink: 0 }}>Pin</span>
      </div>
    )
  }
  const icons = { pdf: PdfIcon, image: AiImageIcon, csv: CsvIcon }
  const labels = { pdf: 'PDF', image: 'Image', csv: 'CSV' }
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: 'rgba(59,54,50,0.07)', border: '1px solid rgba(59,54,50,0.1)',
      borderRadius: 8, padding: '4px 8px', maxWidth: 200,
    }}>
      <HIcon icon={icons[attachment.type as 'pdf' | 'image' | 'csv']} size={12} color="#6A625D" />
      <span style={{ fontSize: 11, color: '#524B47', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
        {attachment.name}
      </span>
      <span style={{ fontSize: 10, color: '#B6ACA4', flexShrink: 0 }}>{labels[attachment.type as 'pdf' | 'image' | 'csv']}</span>
    </div>
  )
}

// Selection CTA — floating "Highlight" button that appears on text selection
function SelectionCTA({
  rect, pinned, onPin,
}: {
  rect: DOMRect
  pinned: boolean
  onPin: () => void
}) {
  const CTAWidth = 110
  const left = Math.max(8, Math.min(
    rect.left + rect.width / 2 - CTAWidth / 2,
    (typeof window !== 'undefined' ? window.innerWidth : 800) - CTAWidth - 8
  ))
  const top = rect.top - 42

  return (
    <motion.div
      id="selection-cta"
      initial={{ opacity: 0, y: 6, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.94 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed', top, left, zIndex: 50,
        width: CTAWidth,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '6px 0',
        borderRadius: 8,
        background: pinned
          ? 'linear-gradient(180deg, #7E5435 0%, #4A2D16 100%)'
          : 'linear-gradient(180deg, #524B47 0%, #26211E 100%)',
        boxShadow: [
          '0px 0px 0px 1px rgba(0,0,0,0.80)',
          '0px 3px 8px rgba(59,54,50,0.30)',
          pinned
            ? 'inset 0px 1px 0.4px rgba(247,242,237,0.38)'
            : 'inset 0px 1px 0.4px rgba(247,242,237,0.20)',
          'inset 0px -2px 0.4px rgba(18,12,8,0.85)',
        ].join(', '),
        cursor: pinned ? 'default' : 'pointer',
        userSelect: 'none',
        transition: 'background 200ms ease',
      }}
      onClick={pinned ? undefined : onPin}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {pinned ? (
          <motion.span key="pinned"
            initial={{ opacity: 0, y: 5, scale: 0.85 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.85 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <HIcon icon={Checkmark} size={11} color="var(--green-400)" strokeWidth={2.5} />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--green-400)', whiteSpace: 'nowrap' }}>Highlighted</span>
          </motion.span>
        ) : (
          <motion.span key="highlight"
            initial={{ opacity: 0, y: 5, scale: 0.85 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.85 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <HIcon icon={Bookmark01Icon} size={12} color="rgba(182,172,164,0.85)" strokeWidth={1.5} />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(182,172,164,0.85)', whiteSpace: 'nowrap' }}>Highlight</span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Citation chip — inline [1] [2] in response text
// Click toggles popover; hover also shows it
function CitationChip({ n, citation }: { n: number; citation?: Citation }) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const isPinned = citation?.domain === 'pin'
  const faviconUrl = citation && !isPinned
    ? `https://www.google.com/s2/favicons?domain=${citation.domain}&sz=32`
    : null

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const showPopover = open || hovered
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <span
        role="button" tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => e.key === 'Enter' && setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 16, height: 16, borderRadius: 4, fontSize: 9, fontWeight: 700,
          background: (showPopover || open) ? '#683D1B' : 'rgba(104,61,27,0.12)',
          color: (showPopover || open) ? 'white' : '#683D1B',
          cursor: 'pointer', transition: 'all 140ms', verticalAlign: 'middle',
          marginLeft: 2, marginRight: 1, lineHeight: 1,
          outline: 'none',
        }}>
        {n}
      </span>
      <AnimatePresence>
        {showPopover && citation && (
          <motion.span
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            style={{
              position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%',
              transform: 'translateX(-50%)',
              background: 'white', borderRadius: 10,
              padding: '8px 10px',
              zIndex: 20,
              boxShadow: '0 4px 16px rgba(59,54,50,0.14), 0 0 0 1px #EDE1D7',
              display: 'flex', alignItems: 'center', gap: 8,
              minWidth: 180, maxWidth: 280,
              whiteSpace: 'nowrap',
            }}>
            {faviconUrl ? (
              <img src={faviconUrl} width={16} height={16}
                style={{ borderRadius: 3, flexShrink: 0, display: 'block' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            ) : (
              <span style={{ fontSize: 12, flexShrink: 0 }}>📌</span>
            )}
            <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
              <span style={{
                fontSize: 12, fontWeight: 500, color: '#26211E',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{citation.title}</span>
              {!isPinned && (
                <span style={{ fontSize: 11, color: '#B6ACA4' }}>{citation.domain}</span>
              )}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  SourceList — horizontal scroll row of citation source cards after response
// ─────────────────────────────────────────────────────────────────────────────
function SourceList({ citations }: { citations: Citation[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--neutral-400)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
        Sources
      </div>
      <div style={{
        display: 'flex', gap: 8,
        overflowX: 'auto', overscrollBehaviorX: 'contain',
        paddingBottom: 2,
      }}>
        {citations.map((c, i) => (
          <SourceCard key={i} citation={c} index={i} />
        ))}
      </div>
    </motion.div>
  )
}

function SourceCard({ citation, index }: { citation: Citation; index: number }) {
  const [hovered, setHovered] = useState(false)
  const isPinned = citation.domain === 'pin'
  const faviconUrl = !isPinned
    ? `https://www.google.com/s2/favicons?domain=${citation.domain}&sz=32`
    : null
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1], delay: 0.18 + index * 0.07 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 10px',
        background: hovered ? 'rgba(104,61,27,0.06)' : 'white',
        border: `1px solid ${hovered ? 'rgba(104,61,27,0.2)' : '#EDE1D7'}`,
        borderRadius: 10,
        cursor: 'pointer',
        maxWidth: 220, minWidth: 140,
        transition: 'background 150ms, border-color 150ms',
      }}>
      {faviconUrl ? (
        <img src={faviconUrl} width={14} height={14}
          style={{ borderRadius: 3, flexShrink: 0, display: 'block' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
      ) : (
        <span style={{ fontSize: 12, lineHeight: 1, flexShrink: 0 }}>📌</span>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 12, fontWeight: 500, color: '#26211E',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{citation.title}</span>
        {!isPinned && (
          <span style={{ fontSize: 10, color: '#B6ACA4', whiteSpace: 'nowrap' }}>{citation.domain}</span>
        )}
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  SouvenirMark — inline SVG logo with independently animated ring + inner mark
// ─────────────────────────────────────────────────────────────────────────────
function SouvenirMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 309 309" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M168.941 131.507C176.475 126.584 186.864 130.006 182.541 135.987L178.915 141.005C175.276 146.04 176.371 151.185 181.686 154.027L187.211 156.981C193.494 160.341 185.62 168.224 176.847 167.357L167.723 166.455C161.03 165.793 153.275 167.689 147.507 171.398L138.855 176.961C131.269 181.838 120.978 178.352 125.361 172.389L128.86 167.629C132.581 162.567 131.511 157.372 126.159 154.511L120.708 151.596C114.425 148.237 122.299 140.353 131.072 141.22L140.064 142.109C146.827 142.778 154.668 140.835 160.447 137.058L168.941 131.507Z" fill="#26211E"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M89.1853 14.4849C126.319 -2.83751 168.814 -4.69913 207.321 9.30974C245.828 23.3187 277.193 52.0513 294.515 89.1854C311.838 126.32 313.699 168.814 299.69 207.321C285.681 245.828 256.949 277.193 219.815 294.515C182.681 311.838 140.186 313.699 101.679 299.69C73.1532 289.312 48.5472 270.854 30.6655 246.887C32.8535 248.323 35.1944 249.668 37.6896 250.912C48.7992 256.448 62.3819 259.962 77.7324 261.307C87.4284 268.277 98.1106 273.953 109.531 278.108C142.313 290.034 178.491 288.45 210.106 273.702C241.72 258.954 266.181 232.252 278.108 199.469C283.403 184.914 286.034 169.69 286.033 154.494C281.08 162.294 274.874 170.072 267.531 177.66C255.47 190.12 240.579 201.823 223.707 212.1C206.835 222.377 188.313 231.027 169.198 237.556C150.084 244.084 130.751 248.363 112.304 250.148C93.8564 251.934 76.6559 251.192 61.6846 247.963C46.7121 244.734 34.2631 239.082 25.0475 231.331C19.5376 226.697 15.5258 221.163 12.527 215.257L12.5597 215.241C11.7017 213.532 10.948 211.784 10.2989 210.004L10.312 209.999C-3.04125 175.311 -3.47945 136.833 9.30965 101.679C23.3187 63.1723 52.0512 31.8074 89.1853 14.4849ZM199.469 30.8923C166.686 18.9659 130.508 20.5505 98.8942 35.298C67.28 50.0456 42.8189 76.7482 30.8923 109.531C25.6071 124.058 22.1938 137.722 21.3143 151.186C26.2178 143.542 32.3225 135.923 39.5193 128.487C51.5798 116.026 66.4713 104.323 83.343 94.0462C100.215 83.7693 118.737 75.1199 137.851 68.5917C156.966 62.0634 176.299 57.7839 194.746 55.9982C205.973 54.9114 216.738 54.7608 226.819 55.5374C229.623 57.945 232.33 60.4734 234.93 63.1176C241.14 69.434 246.681 76.3457 251.478 83.7395C248.196 82.5523 244.55 81.5026 240.524 80.6342C228.296 77.9972 213.526 77.2539 196.959 78.8576C180.437 80.4569 162.851 84.322 145.274 90.3252C127.705 96.3257 110.704 104.271 95.2902 113.66C79.8588 123.06 66.5518 133.58 56.0217 144.459C45.4478 155.384 38.2627 166.06 34.1912 175.648C30.1387 185.192 29.4852 192.851 30.5509 198.596C30.9221 200.596 31.533 202.542 32.4202 204.428C35.0448 209.882 40.173 215.217 48.7685 219.5C59.0176 224.608 73.5755 227.954 91.9162 228.101C110.132 228.248 130.642 225.22 151.71 218.994C172.749 212.777 193.347 203.665 211.75 192.457L211.765 192.482C227.194 183.084 240.499 172.565 251.028 161.687C261.602 150.762 268.787 140.087 272.859 130.499C276.911 120.955 277.565 113.296 276.499 107.551C276.218 106.036 275.977 104.334 275.456 102.822C274.894 101.506 274.309 100.196 273.702 98.8943C258.954 67.2801 232.252 42.8189 199.469 30.8923Z" fill="#26211E"/>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  CyclingLabel — word array that swaps using KDS popLayout + scale/blur pattern
// ─────────────────────────────────────────────────────────────────────────────
function CyclingLabel({ words, textStyle }: { words: string[]; textStyle?: React.CSSProperties }) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    setIdx(0)
    if (words.length <= 1) return
    const t = setInterval(() => setIdx(i => (i + 1) % words.length), 2800)
    return () => clearInterval(t)
  }, [words.join('|')]) // eslint-disable-line
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={idx}
        initial={{ scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
        animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
        exit={{ scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{ display: 'block', transformOrigin: 'left center', ...textStyle }}
      >
        {words[idx]}
      </motion.span>
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  Logo — spinning Souvenir mark → model logo swing-in + glow burst
// ─────────────────────────────────────────────────────────────────────────────
function Logo({ phase, llmId, size = 18 }: { phase: Phase; llmId: string; size?: number }) {
  const showModel  = ['model-chosen', 'researching', 'streaming', 'complete'].includes(phase)
  const isSpinning = ['souvenir', 'thinking', 'choosing'].includes(phase)
  const isFast     = phase === 'choosing'
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <AnimatePresence mode="popLayout" initial={false}>
        {!showModel ? (
          <motion.div key="souvenir"
            initial={{ opacity: 0, scale: 0.5, rotate: -8, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: 1, rotate: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.25, rotate: -20, y: -5, filter: 'blur(10px)', transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            style={{ position: 'absolute', inset: 0 }}>
            <SouvenirMark size={size} />
          </motion.div>
        ) : (
          <motion.div key={`model-${llmId}`}
            initial={{ opacity: 0, scale: 0.15, rotate: 14, filter: 'blur(14px)' }}
            animate={{ opacity: 1, scale: 1, rotate: 0, filter: 'blur(0px)' }}
            transition={{ type: 'spring', stiffness: 220, damping: 11, mass: 0.9, filter: { duration: 0.3, ease: 'easeOut' } }}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LlmIcon id={llmId} size={size} variant="color" />
          </motion.div>
        )}
      </AnimatePresence>
      {phase === 'model-chosen' && (
        <>{[0, 100, 230].map(ms => (
          <motion.div key={ms}
            initial={{ scale: 0.8, opacity: 0.5 }} animate={{ scale: 4.5, opacity: 0 }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1], delay: ms / 1000 }}
            style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1.5px solid rgba(104,61,27,0.35)', pointerEvents: 'none' }} />
        ))}</>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  WordReveal — builds text word-by-word, like a mini stream
// ─────────────────────────────────────────────────────────────────────────────
// Shared inline code style — used across renderInlineMd + renderInlineRich
const INLINE_CODE_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-code)',
  fontSize: 13,
  background: 'var(--neutral-800-10)',
  color: 'var(--neutral-900)',
  borderRadius: 4,
  padding: '1px 5px',
  border: '1px solid var(--neutral-700-12)',
  whiteSpace: 'pre',
}

// renderInlineMd — used in reasoning steps, callout bodies, card bodies
// Supports: **bold**, `inline code`, [text](url) links
function renderInlineMd(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} style={{ fontWeight: 600, color: 'var(--neutral-900)' }}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} style={INLINE_CODE_STYLE}>{part.slice(1, -1)}</code>
    const lm = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/)
    if (lm) return <a key={i} href={lm[2]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brown-500)', textDecoration: 'underline', textUnderlineOffset: 2 }}>{lm[1]}</a>
    return <span key={i}>{part}</span>
  })
}

function WordReveal({ text, wordDelay = 55 }: { text: string; wordDelay?: number }) {
  const words = text.split(' ')
  const [revealed, setRevealed] = useState(0)
  useEffect(() => {
    setRevealed(0)
    let idx = 0
    const t = setInterval(() => {
      idx++
      setRevealed(idx)
      if (idx >= words.length) clearInterval(t)
    }, wordDelay)
    return () => clearInterval(t)
  }, [text]) // eslint-disable-line
  return <>{words.slice(0, revealed).join(' ')}</>
}

// ─────────────────────────────────────────────────────────────────────────────
//  ModelRow
// ─────────────────────────────────────────────────────────────────────────────
function ModelRow({
  phase, label, model, skipRouting,
  researchTitleVisible, researchTitle, isResearchOpen, hasResearch, onToggle,
}: {
  phase: Phase; label: string; model: typeof MODEL_OPTIONS[0]; skipRouting?: boolean
  researchTitleVisible: boolean; researchTitle: string | null; isResearchOpen: boolean
  hasResearch: boolean; onToggle: () => void
}) {
  const showCtrl = hasResearch && ['researching', 'streaming', 'complete'].includes(phase)
  const isChoosing = phase === 'choosing'
  const showLogo = !skipRouting

  return (
    <motion.div
      animate={isChoosing ? { opacity: [0.45, 1, 0.45] } : { opacity: 1 }}
      transition={isChoosing ? { duration: 1.0, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
      style={{ display: 'flex', alignItems: 'center', gap: 7, minHeight: 20 }}
    >
      {showLogo && <Logo phase={phase} llmId={model.llmId} size={16} />}
      {!showLogo && <SouvenirMark size={16} />}

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', overflow: 'hidden', minWidth: 0 }}>
        {label && (() => {
          const shimmerActive = ['souvenir', 'thinking', 'choosing'].includes(phase)
          const labelBaseStyle: React.CSSProperties = {
            fontSize: 14, fontWeight: 500, lineHeight: '18px', flexShrink: 0,
            transformOrigin: 'left center',
          }
          const shimmerStyle: React.CSSProperties = shimmerActive ? {
            backgroundImage: 'linear-gradient(90deg, #B6ACA4 0%, #3B3632 45%, #3B3632 55%, #B6ACA4 100%)',
            backgroundSize: '200% 100%',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
            animation: 'svLabelShimmer 2.4s ease-in-out infinite',
          } : { color: '#524B47' }

          return (
            <AnimatePresence mode="popLayout" initial={false}>
              {phase === 'thinking' ? (
                <motion.div key="thinking"
                  initial={{ opacity: 0, filter: 'blur(5px)', scale: 0.82 }}
                  animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
                  exit={{ opacity: 0, filter: 'blur(5px)', scale: 0.82 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 32 }}
                  style={{ flexShrink: 0 }}>
                  <CyclingLabel words={THINKING_WORDS} textStyle={{ ...labelBaseStyle, ...shimmerStyle }} />
                </motion.div>
              ) : (
                <motion.span key={label}
                  initial={{ opacity: 0, filter: 'blur(5px)', scale: 0.82, y: 5 }}
                  animate={{ opacity: 1, filter: 'blur(0px)', scale: 1, y: 0 }}
                  exit={{ opacity: 0, filter: 'blur(5px)', scale: 0.82, y: -5 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 32 }}
                  style={{ ...labelBaseStyle, ...shimmerStyle, display: 'block' }}>
                  {label}
                </motion.span>
              )}
            </AnimatePresence>
          )
        })()}
        <AnimatePresence>
          {researchTitleVisible && researchTitle && (
            <motion.span
              initial={{ opacity: 0, x: 10, filter: 'blur(8px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
              style={{
                fontSize: 14, color: '#9A9089', marginLeft: 4,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                flexShrink: 1, minWidth: 0,
              }}>
              · <WordReveal text={researchTitle} wordDelay={80} />
            </motion.span>
          )}
        </AnimatePresence>

        {showCtrl && (
          <button onClick={onToggle} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: 3, marginLeft: 4, display: 'flex', alignItems: 'center',
            borderRadius: 4, flexShrink: 0,
          }}>
            <Chevron isOpen={isResearchOpen} />
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  ReasoningStep — individual stacked row, expandable
// ─────────────────────────────────────────────────────────────────────────────
function ReasoningStepRow({
  step, isExpanded, onToggle, isActive, isLast,
}: { step: ReasoningStep; isExpanded: boolean; onToggle: () => void; isActive: boolean; isLast: boolean }) {
  const verbStyle: React.CSSProperties = isActive ? {
    fontWeight: 600,
    backgroundImage: 'linear-gradient(90deg, #B6ACA4 0%, #3B3632 45%, #3B3632 55%, #B6ACA4 100%)',
    backgroundSize: '200% 100%',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    animation: 'svLabelShimmer 2.4s ease-in-out infinite',
  } : { fontWeight: 600, color: '#26211E' }

  return (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', paddingBottom: isLast ? 0 : 12 }}>

      {/* Left column — icon + vertical connector */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
        <span style={{ width: 20, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0, flexShrink: 0 }}>
          {(() => {
            const ri = REASONING_ICON[step.verb] ?? { icon: AiNetworkIcon, isHuge: true }
            return ri.isHuge
              ? <HIcon icon={ri.icon} size={16} color={isActive ? '#A89488' : '#C0B5AD'} strokeWidth={1.5} />
              : <ri.icon size={16} color={isActive ? '#A89488' : '#C0B5AD'} />
          })()}
        </span>
        <AnimatePresence>
          {!isLast && (
            <motion.div
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{ duration: 0.28, ease: 'easeOut', delay: 0.1 }}
              style={{ width: 1, flex: 1, background: '#EDE1D7', transformOrigin: 'top', minHeight: 12 }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Right column — button row + expanded summary */}
      <div style={{ flex: 1, paddingLeft: 10, display: 'flex', flexDirection: 'column' }}>
        <button onClick={onToggle} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          background: 'transparent', border: 'none', cursor: 'pointer', padding: '5px 0', textAlign: 'left',
        }}>
          <span style={{ fontSize: 14, color: '#524B47', flex: 1 }}>
            <strong style={verbStyle}>{step.verb}{isActive ? '…' : ''}</strong>
            {!isActive && <>{' '}{step.detail}</>}
          </span>
          {!isActive && (
            <motion.span
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              style={{ display: 'flex', alignItems: 'center', lineHeight: 0, flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
                <path d="M3.5 2 L7 5 L3.5 8" stroke="#C0B5AD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.span>
          )}
        </button>
        <AnimatePresence initial={false}>
          {isExpanded && !isActive && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={{ overflow: 'hidden' }}>
              <p style={{
                fontSize: 14, color: '#524B47', lineHeight: '22px',
                borderLeft: '2px solid #EDE1D7', paddingLeft: 10, margin: '8px 0 6px 0',
              }}>
                {renderInlineMd(step.summary)}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  ActivityRow — one AI action with icon, verb, detail, status
// ─────────────────────────────────────────────────────────────────────────────
function ActivityRow({
  activity, revealedResults, isActive, readingResultIdxs,
}: { activity: ActivityItem; revealedResults: number; isActive: boolean; readingResultIdxs?: Set<number> }) {
  const isDone = !isActive
  const verb = ACTIVITY_VERB[activity.type]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Status icon */}
        {isActive ? (
          <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{ display: 'flex', alignItems: 'center', lineHeight: 0, flexShrink: 0 }}>
            <HIcon icon={Spinner} size={16} color="#B6ACA4" strokeWidth={2} />
          </motion.span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', lineHeight: 0, flexShrink: 0 }}>
            <HIcon icon={Checkmark} size={16} color="#80B707" strokeWidth={2.5} />
          </span>
        )}

        {/* Activity type icon */}
        <span style={{ display: 'flex', alignItems: 'center', lineHeight: 0, flexShrink: 0 }}>
          <ActivityIcon type={activity.type} isDone={isDone} />
        </span>

        {/* Verb */}
        <span style={{ fontSize: 14, fontWeight: 500, color: '#524B47', flexShrink: 0 }}>{verb}</span>

        {/* Detail */}
        {activity.detail && (
          <span style={{
            fontSize: 14, fontWeight: 400, color: '#9A9089',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flex: 1, minWidth: 0,
          }}>
            — {activity.detail}
          </span>
        )}

        {/* Result count */}
        {isDone && activity.resultCount !== undefined && (
          <span style={{ fontSize: 14, fontWeight: 400, color: '#B6ACA4', flexShrink: 0 }}>
            {activity.resultCount} {activity.type === 'read-pins' ? 'pins' : 'results'}
          </span>
        )}
        {isActive && (
          <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }}
            style={{ fontSize: 14, fontWeight: 400, color: '#C0B5AD', flexShrink: 0 }}>
            working…
          </motion.span>
        )}

        {/* Action badge */}
        {activity.badge && <ActionBadge />}
      </div>

      {/* Results */}
      {revealedResults > 0 && activity.results && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 48 }}>
          {activity.results.slice(0, revealedResults).map((r, ri) => {
            const isReading = readingResultIdxs?.has(ri) ?? false
            return (
              <motion.div key={ri}
                initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: ri * 0.04, duration: 0.18 }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 400, minHeight: 20 }}>
                {isReading ? (
                  <motion.span
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                    style={{ color: '#C0B5AD', fontStyle: 'italic', paddingLeft: 10 }}>
                    reading…
                  </motion.span>
                ) : (
                  <>
                    <span style={{ color: '#C0B5AD', flexShrink: 0 }}>·</span>
                    <span style={{ color: '#3B3632', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                    <span style={{ color: '#C0B5AD', flexShrink: 0, fontStyle: r.domain === 'pin' ? 'italic' : 'normal' }}>{r.domain}</span>
                  </>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  ResearchBlock
// ─────────────────────────────────────────────────────────────────────────────
function ResearchBlock({
  isOpen, scenario, showReasoning,
  reasoningCount, expandedReasoningIdxs, thinkingExpanded,
  onToggleReasoning, onToggleThinking,
  activitiesRevealed, resultsRevealed, readingResults, completedGroupCount,
  expandedGroupIdx, onToggleGroup,
}: {
  isOpen: boolean; scenario: ScenarioData; showReasoning: boolean
  reasoningCount: number; expandedReasoningIdxs: Set<number>; thinkingExpanded: boolean
  onToggleReasoning: (i: number) => void; onToggleThinking: () => void
  activitiesRevealed: number; resultsRevealed: number[]; readingResults: Set<string>; completedGroupCount: number
  expandedGroupIdx: number | null; onToggleGroup: (i: number) => void
}) {
  const hasReasoning = showReasoning && scenario.reasoningSteps.length > 0 && reasoningCount > 0
  const hasActivities = scenario.hasActivities

  // Compute which activities belong to which group
  const groupBoundaries: number[] = [] // start index of each group
  let cursor = 0
  scenario.actionGroups.forEach(g => { groupBoundaries.push(cursor); cursor += g.activityCount })

  // Which activities are NOT in a completed group
  const completedUpTo = scenario.actionGroups.slice(0, completedGroupCount).reduce((sum, g) => sum + g.activityCount, 0)

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{
            height:  { type: 'spring', stiffness: 260, damping: 28 },
            opacity: { duration: 0.22, ease: 'easeInOut' },
          }}
          style={{ overflow: 'hidden' }}>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 16,
            paddingTop: 12, paddingBottom: 10,
          }}>

            {/* ── Reasoning section (gated) ── */}
            {hasReasoning && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {scenario.reasoningSteps.slice(0, reasoningCount).map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    transition={{
                      height: { type: 'spring', stiffness: 300, damping: 28 },
                      opacity: { duration: 0.24, delay: 0.08, ease: 'easeOut' },
                    }}
                    style={{ overflow: 'hidden' }}
                  >
                    <ReasoningStepRow
                      step={step}
                      isExpanded={expandedReasoningIdxs.has(i)}
                      onToggle={() => onToggleReasoning(i)}
                      isActive={i === reasoningCount - 1 && reasoningCount < scenario.reasoningSteps.length}
                      isLast={i === reasoningCount - 1}
                    />
                  </motion.div>
                ))}

                {/* "Thinking ›" — summary paragraph */}
                {reasoningCount >= scenario.reasoningSteps.length && scenario.thinkingSummary && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                    <button onClick={onToggleThinking} style={{
                      display: 'flex', alignItems: 'center', gap: 6, background: 'transparent',
                      border: 'none', cursor: 'pointer', padding: '4px 0',
                    }}>
                      <span style={{ fontSize: 14, color: '#9A9089', fontWeight: 500 }}>Thinking</span>
                      <motion.span animate={{ rotate: thinkingExpanded ? 90 : 0 }} transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                        style={{ display: 'flex', lineHeight: 0 }}>
                        <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
                          <path d="M3.5 2 L7 5 L3.5 8" stroke="#C0B5AD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </motion.span>
                    </button>
                    <AnimatePresence initial={false}>
                      {thinkingExpanded && (
                        <motion.p
                          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                          style={{
                            fontSize: 14, color: '#524B47', lineHeight: '22px',
                            borderLeft: '2px solid #EDE1D7', paddingLeft: 10, margin: '4px 0 0 0', overflow: 'hidden',
                          }}>
                          {renderInlineMd(scenario.thinkingSummary)}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </div>
            )}

            {/* Divider */}
            {hasReasoning && hasActivities && activitiesRevealed > 0 && (
              <div style={{ height: 1, background: 'rgba(59,54,50,0.08)' }} />
            )}

            {/* ── Completed groups (collapsed) ── */}
            {scenario.actionGroups.slice(0, completedGroupCount).map((group, gi) => {
              const groupActivities = scenario.activities.slice(groupBoundaries[gi], groupBoundaries[gi] + group.activityCount)
              const isExpanded = expandedGroupIdx === gi
              return (
                <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={() => onToggleGroup(gi)} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'transparent', border: 'none', cursor: 'pointer', padding: '1px 0', textAlign: 'left',
                  }}>
                    <span style={{ display: 'flex', lineHeight: 0, flexShrink: 0 }}>
                      <HIcon icon={Checkmark} size={16} color="#80B707" strokeWidth={2.5} />
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#524B47', flexShrink: 0 }}>
                      Ran {group.activityCount} actions
                    </span>
                    <span style={{ fontSize: 14, color: '#9A9089', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      — {group.summary}
                    </span>
                    <Chevron isOpen={isExpanded} />
                  </button>
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 8, paddingTop: 8 }}>
                          {groupActivities.map((act, ai) => (
                            <div key={ai} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ display: 'flex', lineHeight: 0 }}><HIcon icon={Checkmark} size={12} color="#80B707" strokeWidth={2.5} /></span>
                              <span style={{ display: 'flex', lineHeight: 0 }}><ActivityIcon type={act.type} isDone /></span>
                              <span style={{ fontSize: 14, color: '#6A625D' }}>{ACTIVITY_VERB[act.type]}{act.detail ? ` — ${act.detail}` : ''}</span>
                              {act.badge && <ActionBadge />}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}

            {/* ── In-progress activities ── */}
            {scenario.activities.slice(completedUpTo, activitiesRevealed).map((activity, rawIdx) => {
              const absIdx = completedUpTo + rawIdx
              const isActive = absIdx === activitiesRevealed - 1
              return (
                <motion.div key={absIdx} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                  <ActivityRow
                    activity={activity}
                    revealedResults={resultsRevealed[absIdx] ?? 0}
                    isActive={isActive}
                    readingResultIdxs={new Set(
                      [...readingResults]
                        .filter(k => k.startsWith(`${absIdx}-`))
                        .map(k => parseInt(k.split('-')[1]))
                    )}
                  />
                </motion.div>
              )
            })}

            {/* In-progress pulse */}
            {activitiesRevealed < scenario.activities.length && (
              <motion.div animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: '#C0B5AD' }}>
                <HIcon icon={AiBrain01Icon} size={16} color="#D1C6BD" strokeWidth={1.5} />
                <span>Working…</span>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  StructuredResponseWrapper — handles firstTokenDelay breathing dot for
//  all non-text output types, mirrors StreamingText's "not started" state
// ─────────────────────────────────────────────────────────────────────────────
function StructuredResponseWrapper({ firstTokenDelay, onComplete, children }: {
  firstTokenDelay: number
  onComplete: () => void
  children: (onComplete: () => void) => React.ReactNode
}) {
  const [started, setStarted] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setStarted(true), firstTokenDelay)
    return () => clearTimeout(t)
  }, [firstTokenDelay])

  if (!started) {
    return (
      <div style={{ height: 22, display: 'flex', alignItems: 'center' }}>
        <BreathingDot />
      </div>
    )
  }
  return <>{children(onComplete)}</>
}

// ─────────────────────────────────────────────────────────────────────────────
//  AnimatedTable — staggered row reveal
// ─────────────────────────────────────────────────────────────────────────────
//  TableCell renderer — handles all cell types
// ─────────────────────────────────────────────────────────────────────────────
function renderTableCell(cell: TableCellValue, badgeMap?: TableData['badgeMap']): React.ReactNode {
  // Object cells
  if (typeof cell === 'object') {
    if (cell.type === 'check') {
      return (
        <span style={{
          fontWeight: 600, fontSize: 14,
          color: cell.value ? 'var(--green-600)' : 'var(--neutral-300)',
        }}>
          {cell.value ? '✓' : '—'}
        </span>
      )
    }
    if (cell.type === 'badge') {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          background: cell.bg, color: cell.color,
          border: `1px solid ${cell.border ?? cell.bg}`,
          borderRadius: 99, padding: '2px 9px',
          fontSize: 12, fontWeight: 600, lineHeight: '18px', whiteSpace: 'nowrap',
        }}>
          {cell.label}
        </span>
      )
    }
    if (cell.type === 'rich') {
      return (
        <div>
          <div style={{ fontSize: 14, color: 'var(--neutral-900)', fontWeight: 500 }}>{cell.text}</div>
          {cell.sub && <div style={{ fontSize: 11, color: 'var(--neutral-400)', marginTop: 1 }}>{cell.sub}</div>}
          {cell.badge && (
            <span style={{
              display: 'inline-flex', marginTop: 4,
              background: cell.badge.bg, color: cell.badge.color,
              border: `1px solid ${cell.badge.border ?? cell.badge.bg}`,
              borderRadius: 99, padding: '1px 7px',
              fontSize: 11, fontWeight: 600, lineHeight: '16px',
            }}>
              {cell.badge.label}
            </span>
          )}
        </div>
      )
    }
  }

  // Auto-badge: plain string that matches badgeMap
  const strVal = String(cell)
  if (badgeMap?.[strVal]) {
    const bs = badgeMap[strVal]
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center',
        background: bs.bg, color: bs.color,
        border: `1px solid ${bs.border ?? bs.bg}`,
        borderRadius: 99, padding: '2px 9px',
        fontSize: 12, fontWeight: 600, lineHeight: '18px', whiteSpace: 'nowrap',
      }}>
        {strVal}
      </span>
    )
  }

  // Feature-comparison: auto-detect ✓ / — strings → semantic colors
  if (strVal === '✓') return <span style={{ color: 'var(--green-600)', fontWeight: 700 }}>✓</span>
  if (strVal === '—') return <span style={{ color: 'var(--neutral-300)', fontWeight: 400 }}>—</span>

  return strVal
}

// Sortable raw value extractor (for plain cells only)
function sortableValue(cell: TableCellValue): string | number {
  if (typeof cell === 'string' || typeof cell === 'number') return cell
  if (typeof cell === 'object') {
    if (cell.type === 'badge')   return cell.label
    if (cell.type === 'rich')    return cell.text
    if (cell.type === 'check')   return cell.value ? 1 : 0
  }
  return ''
}

// ─────────────────────────────────────────────────────────────────────────────
//  AnimatedTable — skeleton outline → fill animation
//  Variants: basic | striped | compact | badges | financial | hoverable |
//            minimal | feature-comparison | mixed-content
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedTable({ data, onComplete }: { data: TableData; onComplete: () => void }) {
  const [skeletonVisible, setSkeletonVisible] = useState(true)
  const [revealedRows, setRevealedRows]       = useState(0)
  const [isDone, setIsDone]                   = useState(false)
  const [sortCol, setSortCol]                 = useState<number | null>(null)
  const [sortDir, setSortDir]                 = useState<'asc' | 'desc'>('asc')
  const [mdCopied, setMdCopied]               = useState(false)
  const [hoveredRow, setHoveredRow]           = useState<number | null>(null)

  const v = data.variant ?? 'basic'
  const isCompact   = v === 'compact'
  const isMinimal   = v === 'minimal'
  const isHoverable = v === 'hoverable'
  const isFinancial = v === 'financial'
  const isMixed     = v === 'mixed-content'

  // Grid: feature-comparison gives 2fr to first col; mixed-content gives more room
  const gridCols = data.headers.map((_, ci) => {
    if ((v === 'feature-comparison' || v === 'minimal' || isMixed) && ci === 0) return '2fr'
    return '1fr'
  }).join(' ')

  // Variant-specific padding
  const cellPad = isCompact ? '6px 12px' : (isMixed ? '10px 14px' : '10px 14px')

  // Skeleton dimensions per variant
  const skelH  = isCompact ? 9 : (isMixed ? 28 : 12)
  const skelW  = (ri: number, ci: number) => {
    if (v === 'feature-comparison' && ci > 0) return 30 + ((ri * 7) % 20) // narrow, centred
    if (isFinancial && ci > 0)                return 55 + ((ri * 13 + ci * 9) % 25) // right-aligned
    return 40 + ((ri * 11 + ci * 17 + ri + ci) % 38)
  }

  // Sorted rows — carry origIdx so accentRows/totalsRow checks survive sort
  const displayRows = React.useMemo(() => {
    const indexed = data.rows.map((row, i) => ({ row, origIdx: i }))
    if (sortCol === null) return indexed
    return [...indexed].sort((a, b) => {
      const av = sortableValue(a.row[sortCol]), bv = sortableValue(b.row[sortCol])
      const cmp = (typeof av === 'number' && typeof bv === 'number') ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data.rows, sortCol, sortDir])

  useEffect(() => {
    const rowDelay = isCompact ? 52 : 72
    const skT = setTimeout(() => {
      setSkeletonVisible(false)
      let idx = 0
      const iv = setInterval(() => {
        idx++; setRevealedRows(idx)
        if (idx >= data.rows.length) {
          clearInterval(iv); setIsDone(true); setTimeout(onComplete, 280)
        }
      }, rowDelay)
    }, 500)
    return () => clearTimeout(skT)
  }, []) // eslint-disable-line

  const handleSort = (ci: number) => {
    if (!data.sortable) return
    if (sortCol === ci) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(ci); setSortDir('asc') }
  }

  const copyMarkdown = () => {
    const allRows = [data.headers, ...data.rows]
    const widths  = data.headers.map((_, ci) => Math.max(...allRows.map(r => String(r[ci]).length)))
    const pad     = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - s.length))
    const toRow   = (r: TableCellValue[]) => '| ' + r.map((c, i) => pad(String(typeof c === 'object' ? (c as {text?: string; label?: string}).text ?? (c as {label?: string}).label ?? '' : c), widths[i])).join(' | ') + ' |'
    const sep     = '| ' + widths.map(w => '-'.repeat(w)).join(' | ') + ' |'
    navigator.clipboard.writeText([toRow(data.headers as unknown as TableCellValue[]), sep, ...data.rows.map(toRow)].join('\n')).catch(() => {})
    setMdCopied(true); setTimeout(() => setMdCopied(false), 1500)
  }

  const exportCSV = () => {
    const csv = [data.headers, ...data.rows]
      .map(r => r.map(c => `"${String(typeof c === 'object' ? (c as {text?: string; label?: string}).text ?? (c as {label?: string}).label ?? '' : c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: 'table.csv',
    })
    a.click()
  }

  // Row bg by variant
  const rowBg = (ri: number, isAccentRow: boolean, isTotalsRow: boolean) => {
    if (isAccentRow) return 'rgba(104,61,27,0.04)'
    if (isTotalsRow) return 'var(--neutral-800-05)'
    if (isHoverable && hoveredRow === ri) return 'rgba(104,61,27,0.04)'
    if (v === 'striped' && ri % 2 === 1) return 'var(--neutral-800-05)'
    return 'var(--neutral-white)'
  }

  // Cell border per variant
  const cellBorderLeft = (ci: number) => {
    if (isMinimal || isHoverable || isMixed) return 'none'
    return ci > 0 ? '1px solid var(--neutral-800-05)' : 'none'
  }

  // Row bottom border per variant
  const rowBorderBottom = (ri: number) => {
    if (ri >= data.rows.length - 1) return 'none'
    if (isMinimal) return '1px solid var(--neutral-800-05)'
    return '1px solid var(--neutral-700-12)'
  }

  return (
    <div>

      {/* Variant badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--neutral-300)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          {v} table
        </span>
        {data.sortable && <span style={{ fontSize: 10, color: 'var(--neutral-300)' }}>· click headers to sort</span>}
      </div>

      <div style={{
        border: '1px solid var(--neutral-100)', borderRadius: 12, overflow: 'hidden', fontSize: 14,
        ...(isMinimal ? { border: 'none', borderRadius: 0 } : {}),
      }}>

        {/* Caption */}
        <AnimatePresence>
          {data.caption && isDone && (
            <motion.div key="cap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
              style={{ padding: '7px 14px', borderBottom: '1px solid var(--neutral-100)', fontSize: 11, color: 'var(--neutral-400)', fontStyle: 'italic' }}>
              {data.caption}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Header ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: gridCols,
          background: isMinimal ? 'transparent' : 'var(--neutral-800-05)',
          borderBottom: '1px solid var(--neutral-100)',
        }}>
          {data.headers.map((h, ci) => (
            <div key={ci} onClick={() => handleSort(ci)}
              style={{
                padding: isCompact ? '6px 12px' : '9px 14px',
                fontWeight: 600, color: 'var(--neutral-900)', fontSize: 14, letterSpacing: '0.1px',
                borderLeft: (!isMinimal && !isHoverable) ? (ci > 0 ? '1px solid var(--neutral-800-10)' : 'none') : 'none',
                cursor: data.sortable ? 'pointer' : 'default',
                userSelect: 'none', display: 'flex', alignItems: 'center', gap: 5,
                justifyContent: (isFinancial && ci > 0) ? 'flex-end' : (v === 'feature-comparison' && ci > 0) ? 'center' : 'flex-start',
                transition: 'background 120ms',
              }}
              onMouseEnter={e => { if (data.sortable) e.currentTarget.style.background = 'var(--neutral-800-10)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
              <span>{h}</span>
              {data.sortable && (
                <span style={{ fontSize: 10, lineHeight: 1, color: sortCol === ci ? 'var(--brown-700)' : 'var(--neutral-300)' }}>
                  {sortCol === ci ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* ── Phase 1: Skeleton rows ── */}
        <AnimatePresence>
          {skeletonVisible && (
            <motion.div key="skeleton" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {data.rows.map((_, ri) => (
                <motion.div key={ri}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: ri * 0.045, duration: 0.18 }}
                  style={{
                    display: 'grid', gridTemplateColumns: gridCols,
                    borderBottom: rowBorderBottom(ri),
                    background: v === 'striped' && ri % 2 === 1 ? 'var(--neutral-800-05)' : 'var(--neutral-white)',
                  }}>
                  {data.headers.map((_, ci) => (
                    <div key={ci} style={{
                      padding: cellPad,
                      borderLeft: cellBorderLeft(ci),
                      display: 'flex',
                      justifyContent: (isFinancial && ci > 0) ? 'flex-end' : (v === 'feature-comparison' && ci > 0) ? 'center' : 'flex-start',
                    }}>
                      {isMixed && ci === 0 ? (
                        // Double-line skeleton for rich cells
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%' }}>
                          <motion.div animate={{ opacity: [0.35, 0.85, 0.35] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: (ri + ci) * 0.06 }}
                            style={{ height: 11, width: `${skelW(ri, ci)}%`, background: 'var(--neutral-800-10)', borderRadius: 3 }} />
                          <motion.div animate={{ opacity: [0.25, 0.65, 0.25] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: (ri + ci) * 0.06 + 0.1 }}
                            style={{ height: 8, width: `${skelW(ri, ci) * 0.6}%`, background: 'var(--neutral-800-05)', borderRadius: 3 }} />
                        </div>
                      ) : (
                        <motion.div
                          animate={{ opacity: [0.35, 0.85, 0.35] }}
                          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: (ri + ci) * 0.06 }}
                          style={{ height: skelH, width: `${skelW(ri, ci)}%`, background: 'var(--neutral-800-10)', borderRadius: 4 }}
                        />
                      )}
                    </div>
                  ))}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Phase 2: Real rows fill in ── */}
        <AnimatePresence initial={false}>
          {displayRows.slice(0, revealedRows).map(({ row, origIdx }, ri) => {
            const isTotalsRow = !!(data.totalsRow && origIdx === data.rows.length - 1)
            const isAccentRow = !!(data.accentRows?.includes(origIdx))
            const bg = rowBg(ri, isAccentRow, isTotalsRow)
            return (
              <motion.div key={`r-${origIdx}`}
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                onMouseEnter={() => { if (isHoverable) setHoveredRow(ri) }}
                onMouseLeave={() => { if (isHoverable) setHoveredRow(null) }}
                style={{
                  display: 'grid', gridTemplateColumns: gridCols, position: 'relative',
                  borderBottom: rowBorderBottom(ri),
                  borderTop: isTotalsRow ? '2px solid var(--neutral-800-15)' : 'none',
                  background: bg,
                  transition: 'background 100ms',
                  cursor: isHoverable ? 'pointer' : 'default',
                }}>
                {/* Left accent bar */}
                {isAccentRow && (
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--brown-700)' }} />
                )}
                {row.map((cell, ci) => {
                  const isNumericCell = typeof cell === 'number'
                  const rightAlign = (isFinancial && ci > 0) || isNumericCell
                  const centerAlign = v === 'feature-comparison' && ci > 0 && typeof cell === 'object'
                  return (
                    <div key={ci} style={{
                      padding: cellPad,
                      paddingLeft: isAccentRow && ci === 0 ? 17 : (isCompact ? 12 : 14),
                      color: (ci === 0 && !isTotalsRow) ? 'var(--neutral-900)' : (isTotalsRow ? 'var(--neutral-900)' : 'var(--neutral-700)'),
                      fontWeight: isTotalsRow ? 600 : (ci === 0 && !isMixed ? 500 : 400),
                      borderLeft: cellBorderLeft(ci),
                      fontSize: isCompact ? 12 : (isNumericCell ? 13 : 14),
                      textAlign: rightAlign ? 'right' : centerAlign ? 'center' : 'left',
                      display: centerAlign ? 'flex' : 'block',
                      alignItems: centerAlign ? 'center' : undefined,
                      justifyContent: centerAlign ? 'center' : undefined,
                      lineHeight: isMixed ? '1' : '20px',
                    }}>
                      {renderTableCell(cell, data.badgeMap)}
                    </div>
                  )
                })}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* ── Table actions — appear after fill done ── */}
      <AnimatePresence>
        {isDone && (
          <motion.div key="actions" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, paddingLeft: 1 }}>
            <span style={{ fontSize: 11, color: 'var(--neutral-300)', flex: 1 }}>
              {data.rows.length} rows · {data.headers.length} col
            </span>
            <button onClick={copyMarkdown} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px',
              borderRadius: 6, border: '1px solid var(--neutral-700-12)',
              background: 'transparent', cursor: 'pointer', fontSize: 11, color: 'var(--neutral-500)',
              fontFamily: 'inherit', transition: 'all 120ms',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--neutral-800-05)'; e.currentTarget.style.color = 'var(--neutral-700)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--neutral-500)' }}>
              {mdCopied
                ? <HIcon icon={Checkmark} size={11} color="var(--green-600)" strokeWidth={2.5} />
                : <HIcon icon={Copy01Icon} size={11} color="var(--neutral-500)" strokeWidth={1.5} />}
              {mdCopied ? 'Copied!' : 'Copy markdown'}
            </button>
            <button onClick={exportCSV} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px',
              borderRadius: 6, border: '1px solid var(--neutral-700-12)',
              background: 'transparent', cursor: 'pointer', fontSize: 11, color: 'var(--neutral-500)',
              fontFamily: 'inherit', transition: 'all 120ms',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--neutral-800-05)'; e.currentTarget.style.color = 'var(--neutral-700)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--neutral-500)' }}>
              ↓ Export CSV
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  AnimatedBarChart — 6 variants: vertical | horizontal | grouped | stacked |
//                                  stacked-100 | positive-negative
// ─────────────────────────────────────────────────────────────────────────────

// Module-level shell — stable identity so Framer Motion never resets on re-render
function BarChartShell({ title, variant, children }: { title?: string; variant: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--neutral-white)', border: '1px solid var(--neutral-100)', borderRadius: 12, padding: '16px 18px 14px' }}>
      {title && (
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-900)', marginBottom: 4 }}>{title}</div>
      )}
      <div style={{ fontSize: 10, color: 'var(--neutral-300)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 14 }}>
        {variant} chart
      </div>
      {children}
    </div>
  )
}

const BAR_PALETTE = [
  'var(--brown-700)',   // #683D1B
  'var(--blue-600)',    // #0D6EB2
  'var(--green-600)',   // #80B707
  'var(--neutral-400)', // #9C938B
  'var(--yellow-500)',  // #A28847
  'var(--neutral-700)', // #524B47
]

function AnimatedBarChart({ data, onComplete }: { data: BarChartData; onComplete: () => void }) {
  const [revealed, setRevealed] = useState(false)
  const v = data.variant ?? 'vertical'

  // Dynamic chart height per variant
  const chartH: number = (() => {
    switch (v) {
      case 'positive-negative': return 220
      case 'grouped':           return Math.max((data.labels?.length ?? 1) * 44, 180)
      case 'stacked':           return Math.max((data.labels?.length ?? 1) * 44, 180)
      case 'stacked-100':       return 180
      default:                  return Math.max((data.bars?.length ?? 1) * 36, 140) // vertical + horizontal use this for bar sizing
    }
  })()

  // Per-variant totalDelay so onComplete fires after the last bar settles
  let totalDelay: number
  if (v === 'grouped' || v === 'stacked') {
    const n = (data.labels?.length ?? 1) * (data.datasets?.length ?? 1)
    totalDelay = Math.max(n - 1, 0) * 60 + 980
  } else if (v === 'stacked-100') {
    const n = (data.labels?.length ?? 1) * (data.datasets?.length ?? 1)
    totalDelay = Math.max(n - 1, 0) * 50 + 780
  } else {
    totalDelay = Math.max((data.bars?.length ?? 1) - 1, 0) * 100 + 980
  }

  useEffect(() => {
    const t = setTimeout(() => {
      setRevealed(true)
      setTimeout(onComplete, totalDelay)
    }, 140)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line

  // ── Vertical (default) ─────────────────────────────────────────────────────
  if (v === 'vertical') {
    const maxVal = data.bars.length > 0
      ? (data.maxValue ?? Math.max(...data.bars.map(b => b.value)) * 1.2)
      : 1
    return (
      <BarChartShell title={data.title} variant={v}>
        {/* bars area — position:relative scopes grid lines exactly to bar height */}
        <div style={{ position: 'relative', height: chartH }}>
          {[0.25, 0.5, 0.75, 1].map((pct) => (
            <motion.div key={pct} initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ duration: 0.4, delay: 0.1 }}
              style={{ position: 'absolute', bottom: `${pct * chartH}px`, left: 0, right: 0, height: 1, background: 'var(--neutral-800-10)', pointerEvents: 'none' }} />
          ))}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: '100%' }}>
            {data.bars.map((bar, i) => {
              const barH = Math.max((bar.value / maxVal) * chartH, 4)
              const color = bar.color ?? BAR_PALETTE[i % BAR_PALETTE.length]
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ delay: i * 0.1 + 0.55, duration: 0.2 }}
                    style={{ fontSize: 11, fontWeight: 600, color: 'var(--neutral-700)', marginBottom: 4, lineHeight: 1 }}>
                    {bar.value}{data.unit ?? ''}
                  </motion.div>
                  <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: revealed ? 1 : 0 }}
                    transition={{ type: 'spring', stiffness: 140, damping: 18, mass: 1, delay: i * 0.1 }}
                    style={{ width: '100%', height: barH, background: color, borderRadius: '4px 4px 0 0', transformOrigin: 'bottom' }} />
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ height: 1, background: 'var(--neutral-800-15)', margin: '0 0 8px' }} />
        <div style={{ display: 'flex', gap: 10 }}>
          {data.bars.map((bar, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--neutral-400)', lineHeight: '16px' }}>{bar.label}</div>
          ))}
        </div>
      </BarChartShell>
    )
  }

  // ── Horizontal ─────────────────────────────────────────────────────────────
  if (v === 'horizontal') {
    const maxVal = data.bars.length > 0
      ? Math.max(...data.bars.map(b => b.value)) * 1.1
      : 1
    return (
      <BarChartShell title={data.title} variant={v}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.bars.map((bar, i) => {
            const color = bar.color ?? BAR_PALETTE[i % BAR_PALETTE.length]
            const pct = bar.value / maxVal
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 120, fontSize: 12, color: 'var(--neutral-700)', textAlign: 'right', flexShrink: 0, lineHeight: '16px' }}>{bar.label}</div>
                <div style={{ flex: 1, position: 'relative', height: 24, background: 'var(--neutral-800-05)', borderRadius: 4, overflow: 'hidden' }}>
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: revealed ? 1 : 0 }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20, delay: i * 0.08 }}
                    style={{ position: 'absolute', inset: 0, width: `${pct * 100}%`, background: color, borderRadius: 4, transformOrigin: 'left' }}
                  />
                </div>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ delay: i * 0.08 + 0.5, duration: 0.2 }}
                  style={{ width: 44, fontSize: 12, fontWeight: 600, color: 'var(--neutral-900)', flexShrink: 0 }}>
                  {bar.value}{data.unit ?? ''}
                </motion.div>
              </div>
            )
          })}
        </div>
      </BarChartShell>
    )
  }

  // ── Grouped ────────────────────────────────────────────────────────────────
  if (v === 'grouped' && data.datasets && data.labels) {
    const allVals = data.datasets.flatMap(ds => ds.values)
    const maxVal = allVals.length > 0 ? Math.max(...allVals) * 1.15 : 1
    const nDatasets = data.datasets.length
    return (
      <BarChartShell title={data.title} variant={v}>
        {/* bars area — position:relative scopes grid lines to bar height only */}
        <div style={{ position: 'relative', height: chartH }}>
          {[0.25, 0.5, 0.75, 1].map((pct) => (
            <motion.div key={pct} initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ duration: 0.4, delay: 0.1 }}
              style={{ position: 'absolute', bottom: `${pct * chartH}px`, left: 0, right: 0, height: 1, background: 'var(--neutral-800-10)', pointerEvents: 'none' }} />
          ))}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: '100%' }}>
            {data.labels.map((label, gi) => (
              <div key={gi} style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height: '100%' }}>
                {data.datasets!.map((ds, di) => {
                  const val = ds.values[gi]
                  const barH = Math.max((val / maxVal) * chartH, 3)
                  const color = ds.color ?? BAR_PALETTE[di % BAR_PALETTE.length]
                  const globalIdx = gi * nDatasets + di
                  return (
                    <motion.div key={di}
                      initial={{ scaleY: 0 }} animate={{ scaleY: revealed ? 1 : 0 }}
                      transition={{ type: 'spring', stiffness: 140, damping: 18, mass: 1, delay: globalIdx * 0.06 }}
                      style={{ flex: 1, height: barH, background: color, borderRadius: '3px 3px 0 0', transformOrigin: 'bottom' }} />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <div style={{ height: 1, background: 'var(--neutral-800-15)', margin: '0 0 8px' }} />
        <div style={{ display: 'flex', gap: 16 }}>
          {data.labels.map((label, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--neutral-400)', lineHeight: '16px' }}>{label}</div>
          ))}
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
          {data.datasets.map((ds, di) => (
            <div key={di} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: ds.color ?? BAR_PALETTE[di % BAR_PALETTE.length], flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--neutral-500)' }}>{ds.label}</span>
            </div>
          ))}
        </div>
      </BarChartShell>
    )
  }

  // ── Stacked (absolute) ─────────────────────────────────────────────────────
  if (v === 'stacked' && data.datasets && data.labels) {
    const totals = data.labels.map((_, gi) => data.datasets!.reduce((s, ds) => s + ds.values[gi], 0))
    const maxTotal = Math.max(...totals) * 1.1
    return (
      <BarChartShell title={data.title} variant={v}>
        {/* bars area — position:relative scopes grid lines to bar height only */}
        <div style={{ position: 'relative', height: chartH }}>
          {[0.25, 0.5, 0.75, 1].map((pct) => (
            <motion.div key={pct} initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ duration: 0.4, delay: 0.1 }}
              style={{ position: 'absolute', bottom: `${pct * chartH}px`, left: 0, right: 0, height: 1, background: 'var(--neutral-800-10)', pointerEvents: 'none' }} />
          ))}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: '100%' }}>
            {data.labels.map((label, gi) => {
              const total = totals[gi]
              const colH = (total / maxTotal) * chartH
              return (
                <div key={gi} style={{ flex: 1, height: colH, display: 'flex', flexDirection: 'column-reverse', borderRadius: '4px 4px 0 0', overflow: 'hidden' }}>
                  {data.datasets!.map((ds, di) => {
                    const segH = (ds.values[gi] / maxTotal) * chartH
                    const color = ds.color ?? BAR_PALETTE[di % BAR_PALETTE.length]
                    return (
                      <motion.div key={di}
                        initial={{ height: 0 }} animate={{ height: revealed ? segH : 0 }}
                        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: gi * 0.12 + di * 0.05 }}
                        style={{ width: '100%', background: color, flexShrink: 0 }} />
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ height: 1, background: 'var(--neutral-800-15)', margin: '0 0 8px' }} />
        <div style={{ display: 'flex', gap: 14 }}>
          {data.labels.map((label, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--neutral-400)', lineHeight: '16px' }}>{label}</div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
          {data.datasets.map((ds, di) => (
            <div key={di} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: ds.color ?? BAR_PALETTE[di % BAR_PALETTE.length], flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--neutral-500)' }}>{ds.label}</span>
            </div>
          ))}
        </div>
      </BarChartShell>
    )
  }

  // ── Stacked 100% ───────────────────────────────────────────────────────────
  if (v === 'stacked-100' && data.datasets && data.labels) {
    const totals = data.labels.map((_, gi) => data.datasets!.reduce((s, ds) => s + ds.values[gi], 0))
    return (
      <BarChartShell title={data.title} variant={v}>
        <div style={{ display: 'flex', gap: 10, height: chartH }}>
          {data.labels.map((label, gi) => {
            const total = totals[gi]
            return (
              <div key={gi} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 4, overflow: 'hidden', height: '100%' }}>
                {data.datasets!.map((ds, di) => {
                  const pct = total > 0 ? (ds.values[gi] / total) * 100 : 0
                  const color = ds.color ?? BAR_PALETTE[di % BAR_PALETTE.length]
                  return (
                    <motion.div key={di}
                      initial={{ flex: 0 }} animate={{ flex: revealed ? pct : 0 }}
                      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: gi * 0.1 + di * 0.04 }}
                      style={{ background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minHeight: pct > 8 ? 16 : 0 }}>
                      {pct > 8 && (
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: 600, lineHeight: 1 }}>{Math.round(pct)}%</span>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )
          })}
        </div>
        <div style={{ height: 1, background: 'var(--neutral-800-15)', margin: '6px 0 8px' }} />
        <div style={{ display: 'flex', gap: 10 }}>
          {data.labels.map((label, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--neutral-400)', lineHeight: '16px' }}>{label}</div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
          {data.datasets.map((ds, di) => (
            <div key={di} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: ds.color ?? BAR_PALETTE[di % BAR_PALETTE.length], flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--neutral-500)' }}>{ds.label}</span>
            </div>
          ))}
        </div>
      </BarChartShell>
    )
  }

  // ── Positive / Negative (diverging) ───────────────────────────────────────
  if (v === 'positive-negative') {
    const absMax = Math.max(Math.max(...data.bars.map(b => Math.abs(b.value))) * 1.15, 1)
    const halfH = chartH / 2
    return (
      <BarChartShell title={data.title} variant={v}>
        {/* bars area — split into two fixed halves so bars anchor from the zero line */}
        <div style={{ position: 'relative', height: chartH }}>
          {/* Zero line */}
          <div style={{ position: 'absolute', top: halfH, left: 0, right: 0, height: 1, background: 'var(--neutral-800-30)', zIndex: 1 }} />
          {/* Guide lines at ±50% */}
          {[-1, 1].map(side => (
            <motion.div key={side} initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ duration: 0.4, delay: 0.1 }}
              style={{ position: 'absolute', top: halfH - side * halfH * 0.5, left: 0, right: 0, height: 1, background: 'var(--neutral-800-05)', pointerEvents: 'none' }} />
          ))}
          {/* Bar columns */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', gap: 10 }}>
            {data.bars.map((bar, i) => {
              const color = bar.color ?? (bar.value >= 0 ? 'var(--green-600)' : 'var(--red-400)')
              const barH = Math.max(Math.abs(bar.value) / absMax * halfH, 3)
              const isPos = bar.value >= 0
              return (
                <div key={i} style={{ flex: 1, height: '100%', position: 'relative' }}>
                  {/* Positive half — bar grows upward from center */}
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: halfH, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                    {isPos && (
                      <motion.div
                        initial={{ height: 0 }} animate={{ height: revealed ? barH : 0 }}
                        transition={{ type: 'spring', stiffness: 140, damping: 18, delay: i * 0.1 }}
                        style={{ width: '68%', background: color, borderRadius: '3px 3px 0 0' }} />
                    )}
                  </div>
                  {/* Negative half — bar grows downward from center */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: halfH, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                    {!isPos && (
                      <motion.div
                        initial={{ height: 0 }} animate={{ height: revealed ? barH : 0 }}
                        transition={{ type: 'spring', stiffness: 140, damping: 18, delay: i * 0.1 }}
                        style={{ width: '68%', background: color, borderRadius: '0 0 3px 3px' }} />
                    )}
                  </div>
                  {/* Value label — pinned to zero line, white pill so it never overlaps bar fill */}
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ delay: i * 0.1 + 0.55, duration: 0.2 }}
                    style={{
                      position: 'absolute', top: halfH - 8, left: '50%', transform: 'translateX(-50%)',
                      fontSize: 10, fontWeight: 700, color, lineHeight: '16px',
                      background: 'var(--neutral-white)', padding: '0 3px', borderRadius: 3, zIndex: 2,
                    }}>
                    {bar.value > 0 ? '+' : ''}{bar.value}
                  </motion.div>
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          {data.bars.map((bar, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--neutral-400)', lineHeight: '16px' }}>{bar.label}</div>
          ))}
        </div>
      </BarChartShell>
    )
  }

  // Fallback: vertical is the default — all known variants are handled above
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
//  AnimatedSteps — progressive reveal with connector line + spring dots
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedSteps({ data, onComplete }: { data: StepsData; onComplete: () => void }) {
  const [revealedSteps, setRevealedSteps] = useState(0)

  useEffect(() => {
    let idx = 0
    const interval = setInterval(() => {
      idx++
      setRevealedSteps(idx)
      if (idx >= data.steps.length) {
        clearInterval(interval)
        setTimeout(onComplete, 320)
      }
    }, 220)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>

      {data.title && (
        <div style={{ fontSize: 14, fontWeight: 600, color: '#26211E', marginBottom: 18, lineHeight: '20px' }}>
          {data.title}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence initial={false}>
          {data.steps.slice(0, revealedSteps).map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={{ display: 'flex', gap: 14 }}>

              {/* Left: number dot + connector */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.04 }}
                  style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: '#683D1B', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>
                  {i + 1}
                </motion.div>
                {i < data.steps.length - 1 && (
                  <motion.div
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.22, delay: 0.12, ease: 'easeOut' }}
                    style={{
                      width: 1, flex: 1, minHeight: 20,
                      background: '#EDE1D7', transformOrigin: 'top', marginTop: 4,
                    }}
                  />
                )}
              </div>

              {/* Right: text */}
              <div style={{ paddingBottom: i < data.steps.length - 1 ? 18 : 0, paddingTop: 2, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#26211E', lineHeight: '20px' }}>
                  {step.label}
                </div>
                {step.description && (
                  <div style={{ fontSize: 13, color: '#827A74', lineHeight: '20px', marginTop: 3 }}>
                    {step.description}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  AnimatedCodeBlock — line-by-line reveal with minimal syntax highlighting
// ─────────────────────────────────────────────────────────────────────────────
function highlightCode(line: string): React.ReactNode[] {
  const KW_COLOR  = '#7BB8F5'   // blue — keywords
  const STR_COLOR = '#F0B060'   // amber — strings
  const CMT_COLOR = '#6A625D'   // muted — comments
  const NUM_COLOR = '#C598E8'   // purple — numbers
  const DEF_COLOR = '#E8DDD6'   // default text
  const DIM_COLOR = 'rgba(232,221,214,0.5)' // operators / punctuation

  const JS_KEYWORDS = new Set([
    'import','export','from','const','let','var','function','async','await',
    'return','new','if','else','for','of','in','class','extends','interface',
    'type','default','true','false','null','undefined','process','console','log',
  ])

  if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
    return [<span key="c" style={{ color: CMT_COLOR, fontStyle: 'italic' }}>{line}</span>]
  }

  const tokens: React.ReactNode[] = []
  let rem = line, k = 0

  while (rem.length > 0) {
    // comment mid-line
    if (rem.startsWith('//')) {
      tokens.push(<span key={k++} style={{ color: CMT_COLOR, fontStyle: 'italic' }}>{rem}</span>)
      break
    }
    // string (single, double, template)
    const strM = rem.match(/^(['"`])(?:(?!\1)[^\\]|\\.)*\1/)
    if (strM) { tokens.push(<span key={k++} style={{ color: STR_COLOR }}>{strM[0]}</span>); rem = rem.slice(strM[0].length); continue }
    // word (keyword or identifier)
    const wordM = rem.match(/^[a-zA-Z_$][\w$]*/)
    if (wordM) {
      const w = wordM[0]
      tokens.push(<span key={k++} style={{ color: JS_KEYWORDS.has(w) ? KW_COLOR : DEF_COLOR }}>{w}</span>)
      rem = rem.slice(w.length); continue
    }
    // number
    const numM = rem.match(/^\d+\.?\d*/)
    if (numM) { tokens.push(<span key={k++} style={{ color: NUM_COLOR }}>{numM[0]}</span>); rem = rem.slice(numM[0].length); continue }
    // single char
    const ch = rem[0]
    const isPunct = '.:,;(){}[]=+-><!'.includes(ch)
    tokens.push(<span key={k++} style={{ color: isPunct ? DIM_COLOR : DEF_COLOR }}>{ch}</span>)
    rem = rem.slice(1)
  }
  return tokens
}

// Collapse threshold — lines beyond this get hidden until expanded
const CODE_COLLAPSE_THRESHOLD = 20

function AnimatedCodeBlock({ data, onComplete }: { data: CodeData; onComplete: () => void }) {
  const lines = data.code.split('\n')
  const totalLines = lines.length
  const isLong = totalLines > CODE_COLLAPSE_THRESHOLD

  const [revealedLines, setRevealedLines] = useState(0)
  const [copied,        setCopied]        = useState(false)
  const [expanded,      setExpanded]      = useState(false)
  const [copyHovered,   setCopyHovered]   = useState(false)

  // streaming complete = all lines revealed
  const streamDone = revealedLines >= totalLines

  // Which lines to actually render:
  // During streaming — always show all revealed lines (no collapse mid-stream)
  // After streaming  — collapse to threshold unless expanded
  const visibleLines = streamDone && isLong && !expanded
    ? lines.slice(0, CODE_COLLAPSE_THRESHOLD)
    : lines.slice(0, revealedLines)

  const hiddenCount = totalLines - CODE_COLLAPSE_THRESHOLD

  useEffect(() => {
    let idx = 0
    // Scale interval so very long files don't take forever — cap total reveal at ~1.4s
    const interval = Math.min(55, Math.round(1400 / totalLines))
    const t = setInterval(() => {
      idx++; setRevealedLines(idx)
      if (idx >= totalLines) { clearInterval(t); setTimeout(onComplete, 200) }
    }, interval)
    return () => clearInterval(t)
  }, []) // eslint-disable-line

  const handleCopy = () => {
    navigator.clipboard.writeText(data.code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
      {data.caption && (
        <div style={{ fontSize: 12, color: 'var(--neutral-500)', marginBottom: 6 }}>{data.caption}</div>
      )}
      <div style={{
        background: '#1E1A17', borderRadius: 10, overflow: 'hidden',
        // Outer shadow matching KDS corrosion material treatment
        boxShadow: '0px 0px 0px 1px rgba(0,0,0,0.9), 0px 1px 1px rgba(59,54,50,0.12), 0px 2px 4px rgba(59,54,50,0.28)',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '7px 10px 7px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.055)',
          background: 'linear-gradient(180deg, rgba(82,75,71,0.30) 0%, rgba(38,33,30,0.30) 100%)',
        }}>
          {/* Language badge */}
          <span style={{
            fontSize: 10, fontWeight: 500, letterSpacing: '0.4px',
            color: 'rgba(182,172,164,0.55)',
            fontFamily: 'var(--font-code)',
            textTransform: 'uppercase',
          }}>
            {data.language ?? 'code'}
          </span>

          {/* Copy button — KDS corrosion material adapted for dark context */}
          <motion.button
            onClick={handleCopy}
            onMouseEnter={() => setCopyHovered(true)}
            onMouseLeave={() => setCopyHovered(false)}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.1, ease: 'easeOut' }}
            style={{
              // Fixed width so Copy ↔ Copied never shifts layout
              width: 76, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '5px 0 6px',
              borderRadius: 8, border: 'none', cursor: 'pointer',
              // KDS corrosion gradient — lightens on hover (neutral-600/800 vs 700/900)
              background: copyHovered
                ? 'linear-gradient(180deg, #6A625D 0%, #3B3632 100%)'
                : 'linear-gradient(180deg, #524B47 0%, #26211E 100%)',
              // Outer ring + lift shadow
              boxShadow: [
                '0px 0px 0px 1px rgba(0,0,0,0.85)',
                '0px 1px 1px rgba(59,54,50,0.10)',
                '0px 1.5px 3px rgba(59,54,50,0.35)',
                // Inner top highlight brightens on hover (from Figma inset spec)
                copyHovered
                  ? 'inset 0px 1px 0.4px rgba(247,242,237,0.42)'
                  : 'inset 0px 1px 0.4px rgba(247,242,237,0.28)',
                'inset 0px -2px 0.4px #120C08',
                copyHovered
                  ? 'inset 0px -2.5px 4px -2px rgba(247,242,237,0.60)'
                  : 'inset 0px -2.5px 4px -2px rgba(247,242,237,0.45)',
              ].join(', '),
              transition: 'background 160ms ease, box-shadow 160ms ease',
              position: 'relative', overflow: 'hidden',
            }}>
            <AnimatePresence mode="popLayout" initial={false}>
              {copied ? (
                <motion.span key="done"
                  initial={{ opacity: 0, y: 6, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.85 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <HIcon icon={Checkmark} size={12} color="var(--green-600)" strokeWidth={2.5} />
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--green-600)', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>Copied</span>
                </motion.span>
              ) : (
                <motion.span key="copy"
                  initial={{ opacity: 0, y: 6, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.85 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <HIcon icon={Copy01Icon} size={12} color="rgba(182,172,164,0.72)" strokeWidth={1.5} />
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(182,172,164,0.72)', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>Copy</span>
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        {/* ── Code body ── */}
        <pre style={{
          margin: 0, padding: '14px 16px',
          fontSize: 13, lineHeight: '20px',
          fontFamily: 'var(--font-code)',
          overflowX: 'auto',
          // No max-height — page scroll handles everything. No dual-scroll hell.
        }}>
          {visibleLines.map((line, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.08 }}
              style={{ display: 'flex', gap: 14 }}>
              <span style={{
                color: 'rgba(59,54,50,0.55)', userSelect: 'none',
                fontSize: 11, minWidth: 18, textAlign: 'right',
                flexShrink: 0, lineHeight: '20px',
              }}>
                {i + 1}
              </span>
              <span>{highlightCode(line)}</span>
            </motion.div>
          ))}
          {/* Streaming cursor */}
          {!streamDone && (
            <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 0.7, repeat: Infinity }}
              style={{ display: 'inline-block', width: 7, height: 14, background: '#683D1B', borderRadius: 1, verticalAlign: 'middle', marginLeft: 32 }} />
          )}
        </pre>

        {/* ── Collapse / expand footer — only shows after streaming, only for long blocks ── */}
        <AnimatePresence initial={false}>
          {streamDone && isLong && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}>
              {!expanded ? (
                // Collapsed — gradient fade + expand button
                <div style={{ position: 'relative' }}>
                  {/* Fade-out gradient over last visible lines */}
                  <div style={{
                    position: 'absolute', top: -48, left: 0, right: 0, height: 48,
                    background: 'linear-gradient(to bottom, transparent, #1E1A17)',
                    pointerEvents: 'none',
                  }} />
                  <button onClick={() => setExpanded(true)} style={{
                    width: '100%', padding: '10px 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    background: 'rgba(255,255,255,0.03)',
                    borderTop: '1px solid rgba(255,255,255,0.055)',
                    border: 'none', borderRadius: '0 0 10px 10px',
                    cursor: 'pointer',
                    transition: 'background 120ms',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 4.5 L6 8 L10 4.5" stroke="rgba(182,172,164,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(182,172,164,0.5)', fontFamily: 'var(--font-body)' }}>
                      Show {hiddenCount} more {hiddenCount === 1 ? 'line' : 'lines'} of code
                    </span>
                  </button>
                </div>
              ) : (
                // Expanded — collapse button
                <button onClick={() => setExpanded(false)} style={{
                  width: '100%', padding: '10px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  background: 'rgba(255,255,255,0.03)',
                  borderTop: '1px solid rgba(255,255,255,0.055)',
                  border: 'none', borderRadius: '0 0 10px 10px',
                  cursor: 'pointer',
                  transition: 'background 120ms',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 7.5 L6 4 L10 7.5" stroke="rgba(182,172,164,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(182,172,164,0.5)', fontFamily: 'var(--font-body)' }}>
                    Show less
                  </span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  AnimatedCallout — slide-in with left border accent
// ─────────────────────────────────────────────────────────────────────────────
const CALLOUT_CFG = {
  info:    { bg: 'rgba(13,110,178,0.07)',   border: '#0D6EB2', icon: InformationCircleIcon, isHuge: true, color: '#0D6EB2' },
  warning: { bg: 'rgba(200,146,10,0.08)',   border: '#C8920A', icon: Alert01Icon,           isHuge: true, color: '#C8920A' },
  success: { bg: 'rgba(128,183,7,0.07)',    border: '#80B707', icon: CheckmarkCircle01Icon, isHuge: true, color: '#80B707' },
  error:   { bg: 'rgba(200,50,50,0.07)',    border: '#C83232', icon: Cancel01Icon,          isHuge: true, color: '#C83232' },
  tip:     { bg: 'rgba(104,61,27,0.07)',    border: '#683D1B', icon: Idea01Icon,            isHuge: true, color: '#683D1B' },
} as const

function AnimatedCallout({ data, onComplete }: { data: CalloutData; onComplete: () => void }) {
  const cfg = CALLOUT_CFG[data.variant]
  useEffect(() => { const t = setTimeout(onComplete, 440); return () => clearTimeout(t) }, []) // eslint-disable-line

  return (
    <motion.div
      initial={{ opacity: 0, x: -10, y: 4 }} animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 26 }}
      style={{
        borderLeft: `3px solid ${cfg.border}`, background: cfg.bg,
        borderRadius: '0 10px 10px 0', padding: '10px 14px',
        display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
      <span style={{ flexShrink: 0, marginTop: 1, lineHeight: 0 }}>
        <HIcon icon={cfg.icon} size={16} color={cfg.color} strokeWidth={1.8} />
      </span>
      <div>
        {data.title && (
          <div style={{ fontWeight: 600, fontSize: 14, color: '#26211E', marginBottom: 4, lineHeight: '20px' }}>{data.title}</div>
        )}
        <div style={{ fontSize: 14, lineHeight: '21px', color: '#524B47' }}>{renderInlineMd(data.body)}</div>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  AnimatedTags — spring-stagger pill reveal
// ─────────────────────────────────────────────────────────────────────────────
const TAG_PALETTES = [
  { bg: 'rgba(104,61,27,0.1)',   text: '#683D1B',  border: 'rgba(104,61,27,0.2)' },
  { bg: 'rgba(59,54,50,0.07)',   text: '#524B47',  border: 'rgba(59,54,50,0.14)' },
  { bg: 'rgba(13,110,178,0.09)', text: '#0D6EB2',  border: 'rgba(13,110,178,0.18)' },
  { bg: 'rgba(128,183,7,0.09)',  text: '#627A1A',  border: 'rgba(128,183,7,0.2)' },
  { bg: 'rgba(156,147,139,0.12)',text: '#6A625D',  border: 'rgba(156,147,139,0.24)' },
]

function AnimatedTags({ data, onComplete }: { data: TagsData; onComplete: () => void }) {
  const [revealedTags, setRevealedTags] = useState(0)

  useEffect(() => {
    let idx = 0
    const t = setInterval(() => {
      idx++; setRevealedTags(idx)
      if (idx >= data.tags.length) { clearInterval(t); setTimeout(onComplete, 160) }
    }, 90)
    return () => clearInterval(t)
  }, []) // eslint-disable-line

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
      {data.title && (
        <div style={{ fontSize: 12, fontWeight: 500, color: '#9A9089', marginBottom: 9, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {data.title}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {data.tags.slice(0, revealedTags).map((tag, i) => {
          const pal = TAG_PALETTES[i % TAG_PALETTES.length]
          const bg  = tag.color ? `${tag.color}15` : pal.bg
          const fg  = tag.color ?? pal.text
          const bd  = tag.color ? `${tag.color}28` : pal.border
          return (
            <motion.span key={i}
              initial={{ scale: 0.55, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 22 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                background: bg, border: `1px solid ${bd}`, color: fg,
                borderRadius: 99, padding: '3px 11px',
                fontSize: 13, fontWeight: 500, lineHeight: '19px',
              }}>
                {tag.label}
              </span>
            </motion.span>
          )
        })}
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  AnimatedPieChart — SVG donut, full-width, large ring, legend below
// ─────────────────────────────────────────────────────────────────────────────
const PIE_COLORS = [
  'var(--brown-700)',
  'var(--blue-600)',
  'var(--green-600)',
  'var(--neutral-400)',
  'var(--neutral-700)',
  'var(--yellow-500)',
]
// Resolved hex values for SVG stroke (CSS vars don't work in SVG stroke attr)
const PIE_COLORS_HEX = ['#683D1B', '#0D6EB2', '#80B707', '#9C938B', '#524B47', '#A28847']

function AnimatedPieChart({ data, onComplete }: { data: PieChartData; onComplete: () => void }) {
  const [revealedCount, setRevealedCount] = useState(0)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  // Large donut: R=90, SW=26, viewBox 220×220
  const R = 90, CX = 110, CY = 110, SW = 26
  const circ = 2 * Math.PI * R

  const total = data.segments.reduce((s, seg) => s + seg.value, 0)
  let cumPct = 0
  const arcs = data.segments.map((seg, i) => {
    const pct      = seg.value / total
    const startDeg = cumPct * 360 - 90
    cumPct += pct
    return {
      pct, startDeg,
      dashLen: pct * circ,
      gapLen:  (1 - pct) * circ,
      color:   seg.color ?? PIE_COLORS_HEX[i % PIE_COLORS_HEX.length],
      label:   seg.label,
      value:   seg.value,
    }
  })

  useEffect(() => {
    let idx = 0
    const t = setInterval(() => {
      idx++; setRevealedCount(idx)
      if (idx >= data.segments.length) { clearInterval(t); setTimeout(onComplete, 800) }
    }, 180)
    return () => clearInterval(t)
  }, []) // eslint-disable-line

  return (
    <div style={{ background: 'var(--neutral-white)', border: '1px solid var(--neutral-100)', borderRadius: 12, padding: '18px 20px' }}>
      {data.title && (
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-900)', marginBottom: 4 }}>{data.title}</div>
      )}
      <div style={{ fontSize: 10, color: 'var(--neutral-300)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 16 }}>
        pie chart
      </div>
      {/* Donut — centered, full-width responsive via viewBox */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <svg width={220} height={220} viewBox="0 0 220 220" style={{ display: 'block', maxWidth: '100%' }}>
          {/* Track ring */}
          <circle r={R} cx={CX} cy={CY} fill="none" stroke="rgba(59,54,50,0.07)" strokeWidth={SW} />
          {arcs.map((arc, i) => (
            <circle key={i}
              r={R} cx={CX} cy={CY} fill="none"
              stroke={arc.color}
              strokeWidth={i === hoveredIdx ? SW + 4 : SW}
              strokeDasharray={`${arc.dashLen} ${arc.gapLen}`}
              strokeDashoffset={i < revealedCount ? 0 : arc.dashLen}
              transform={`rotate(${arc.startDeg} ${CX} ${CY})`}
              style={{
                transition: 'stroke-dashoffset 0.52s cubic-bezier(0.16,1,0.3,1), stroke-width 120ms',
                strokeLinecap: 'butt',
                cursor: 'pointer',
              }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ))}
          {/* Center — total or hovered segment */}
          {hoveredIdx !== null ? (
            <>
              <text x={CX} y={CY - 6} textAnchor="middle" fill={arcs[hoveredIdx].color} fontSize={22} fontWeight="700" fontFamily="Geist, sans-serif">
                {Math.round(arcs[hoveredIdx].pct * 100)}%
              </text>
              <text x={CX} y={CY + 16} textAnchor="middle" fill="#9C938B" fontSize={10} fontFamily="Geist, sans-serif">
                {data.unit ? `${Math.round(arcs[hoveredIdx].pct * total)}${data.unit}` : arcs[hoveredIdx].label.split(' ').slice(0, 2).join(' ')}
              </text>
            </>
          ) : (
            <>
              {data.centerLabel && (
                <text x={CX} y={CY - 4} textAnchor="middle" fill="#26211E" fontSize={24} fontWeight="700" fontFamily="Geist, sans-serif">
                  {data.centerLabel}
                </text>
              )}
              <text x={CX} y={CY + 16} textAnchor="middle" fill="#9C938B" fontSize={10} fontFamily="Geist, sans-serif">
                total
              </text>
            </>
          )}
        </svg>
      </div>
      {/* Legend — two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
        {arcs.map((arc, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: i < revealedCount ? 1 : 0, y: i < revealedCount ? 0 : 4 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'default', opacity: hoveredIdx !== null && hoveredIdx !== i ? 0.45 : undefined, transition: 'opacity 120ms' }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: arc.color, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--neutral-700)', lineHeight: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{arc.label}</div>
              <div style={{ fontSize: 11, color: 'var(--neutral-400)', lineHeight: '15px' }}>
                {Math.round(arc.pct * 100)}%
                {data.unit && <span style={{ marginLeft: 4 }}>{Math.round(arc.pct * total)}{data.unit}</span>}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  AnimatedLineChart — SVG polyline with pathLength stroke-dashoffset draw
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedLineChart({ data, onComplete }: { data: LineChartData; onComplete: () => void }) {
  const [revealed, setRevealed] = useState(false)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [hoverContainerX, setHoverContainerX] = useState(0)
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const W = 700, H = 160
  const PAD = { top: 14, right: 18, bottom: 32, left: 38 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom
  const LINE_COLORS = ['#683D1B', '#0D6EB2', '#80B707', '#9C938B']

  const allY = data.lines.flatMap(l => l.points.map(p => p.y))
  const minY = Math.min(...allY)
  const maxY = Math.max(...allY)
  const range = maxY - minY || 1
  const maxXIdx = (data.lines[0]?.points.length ?? 1) - 1 || 1

  const toSVG = (xi: number, y: number) => ({
    x: PAD.left + (xi / maxXIdx) * chartW,
    y: PAD.top + (1 - (y - minY) / range) * chartH,
  })

  useEffect(() => {
    const t = setTimeout(() => {
      setRevealed(true)
      setTimeout(onComplete, 1300)
    }, 120)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !containerRef.current) return
    const svgRect  = svgRef.current.getBoundingClientRect()
    const contRect = containerRef.current.getBoundingClientRect()
    // Convert mouse position to SVG viewBox coordinates
    const scaleX = W / svgRect.width
    const svgX   = (e.clientX - svgRect.left) * scaleX
    // Clamp to chart area
    if (svgX < PAD.left || svgX > PAD.left + chartW) { setHoverIdx(null); return }
    const xi = Math.round((svgX - PAD.left) / chartW * maxXIdx)
    const clampedXi = Math.max(0, Math.min(maxXIdx, xi))
    setHoverIdx(clampedXi)
    // Track container-relative pixel x for tooltip positioning
    setHoverContainerX(e.clientX - contRect.left)
  }

  const handleMouseLeave = () => setHoverIdx(null)

  // Tooltip content at hoverIdx
  const tooltipItems = hoverIdx !== null
    ? data.lines.map((line, li) => ({
        label: line.label ?? `Series ${li + 1}`,
        value: line.points[hoverIdx]?.y ?? 0,
        color: line.color ?? LINE_COLORS[li % LINE_COLORS.length],
      }))
    : []

  // Crosshair SVG x coordinate
  const crosshairSvgX = hoverIdx !== null ? PAD.left + (hoverIdx / maxXIdx) * chartW : 0
  // Tooltip: clamp so it stays within container
  const tooltipWidth = 120
  const tooltipLeft  = Math.min(
    Math.max(hoverContainerX - tooltipWidth / 2, 4),
    (containerRef.current?.clientWidth ?? 360) - tooltipWidth - 4
  )

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: 'var(--neutral-white)', border: '1px solid var(--neutral-100)', borderRadius: 12, padding: '16px 18px 12px' }}>
      {data.title && (
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-900)', marginBottom: 14 }}>{data.title}</div>
      )}

      {/* SVG + tooltip wrapper */}
      <div ref={containerRef} style={{ position: 'relative' }}>
        <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`}
          style={{ display: 'block', overflow: 'visible', cursor: 'crosshair' }}
          onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(pct => {
            const yv = PAD.top + pct * chartH
            return (
              <motion.line key={pct}
                x1={PAD.left} x2={PAD.left + chartW} y1={yv} y2={yv}
                stroke="rgba(59,54,50,0.07)" strokeWidth={1}
                initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ duration: 0.3, delay: 0.1 }}
              />
            )
          })}

          {/* Y-axis labels */}
          {[0, 0.5, 1].map(pct => {
            const val = maxY - pct * range
            return (
              <text key={pct} x={PAD.left - 6} y={PAD.top + pct * chartH + 4}
                textAnchor="end" fill="#C0B5AD" fontSize={11} fontFamily="Geist, sans-serif">
                {Math.round(val)}{data.unit ?? ''}
              </text>
            )
          })}

          {/* Lines */}
          {data.lines.map((line, li) => {
            const color   = line.color ?? LINE_COLORS[li % LINE_COLORS.length]
            const pts     = line.points.map((p, i) => { const { x, y } = toSVG(i, p.y); return `${x},${y}` }).join(' ')
            const areaPts = pts + ` ${PAD.left + chartW},${PAD.top + chartH} ${PAD.left},${PAD.top + chartH}`
            return (
              <g key={li}>
                {/* Area fill */}
                <motion.polygon points={areaPts} fill={`${color}10`} stroke="none"
                  initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ delay: 0.35, duration: 0.4 }} />
                {/* Line — pathLength trick */}
                <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5}
                  pathLength={1} strokeDasharray="1"
                  strokeDashoffset={revealed ? 0 : 1} strokeLinecap="round" strokeLinejoin="round"
                  style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1)' }} />
                {/* Regular dots */}
                {line.points.map((p, i) => {
                  const { x, y } = toSVG(i, p.y)
                  const isHovered = hoverIdx === i
                  return (
                    <motion.circle key={i} cx={x} cy={y}
                      r={isHovered ? 4 : 2.5}
                      fill={isHovered ? 'var(--neutral-white)' : color}
                      stroke={isHovered ? color : 'none'}
                      strokeWidth={isHovered ? 2 : 0}
                      initial={{ scale: 0 }} animate={{ scale: revealed ? 1 : 0 }}
                      transition={{ type: 'spring', stiffness: 480, damping: 22, delay: revealed ? 0 : 0.9 + i * 0.025 }}
                      style={{ transformOrigin: `${x}px ${y}px` }} />
                  )
                })}
              </g>
            )
          })}

          {/* X-axis baseline */}
          <line x1={PAD.left} x2={PAD.left + chartW} y1={PAD.top + chartH} y2={PAD.top + chartH}
            stroke="rgba(59,54,50,0.14)" strokeWidth={0.8} />

          {/* X-axis labels — sparse */}
          {data.lines[0]?.points.map((p, i) => {
            const total = data.lines[0].points.length
            const skip  = Math.ceil(total / 7)
            if (i % skip !== 0 && i !== total - 1) return null
            const { x } = toSVG(i, 0)
            return (
              <text key={i} x={x} y={H - 6} textAnchor="middle" fill="#C0B5AD" fontSize={11} fontFamily="Geist, sans-serif">
                {p.x}
              </text>
            )
          })}

          {/* Crosshair — vertical line */}
          {hoverIdx !== null && (
            <line
              x1={crosshairSvgX} x2={crosshairSvgX}
              y1={PAD.top} y2={PAD.top + chartH}
              stroke="rgba(59,54,50,0.18)" strokeWidth={0.8} strokeDasharray="4 3"
            />
          )}
        </svg>

        {/* Floating tooltip */}
        <AnimatePresence initial={false}>
          {hoverIdx !== null && tooltipItems.length > 0 && (
            <motion.div
              key="tooltip"
              initial={{ opacity: 0, y: 4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              style={{
                position: 'absolute',
                top: -8,
                left: tooltipLeft,
                width: tooltipWidth,
                background: 'var(--neutral-900)',
                borderRadius: 8,
                padding: '7px 10px',
                pointerEvents: 'none',
                zIndex: 10,
                boxShadow: '0 4px 12px rgba(18,12,8,0.22)',
              }}>
              {/* X label */}
              <div style={{ fontSize: 10, color: 'var(--neutral-400)', fontWeight: 500, marginBottom: 5, letterSpacing: '0.3px' }}>
                {data.lines[0]?.points[hoverIdx]?.x}
              </div>
              {tooltipItems.map((item, ti) => (
                <div key={ti} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  marginTop: ti > 0 ? 3 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                    {tooltipItems.length > 1 && (
                      <span style={{ fontSize: 10, color: 'var(--neutral-400)', maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.label}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--neutral-white)', fontVariantNumeric: 'tabular-nums' }}>
                    {item.value}{data.unit ?? ''}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Multi-line legend */}
      {data.lines.length > 1 && (
        <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
          {data.lines.map((line, li) => (
            <div key={li} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 12, height: 2, background: line.color ?? LINE_COLORS[li % LINE_COLORS.length], borderRadius: 2 }} />
              <span style={{ fontSize: 11, color: 'var(--neutral-500)' }}>{line.label}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  AnimatedCard — general-purpose info card
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedCard({ data, onComplete }: { data: CardData; onComplete: () => void }) {
  useEffect(() => { const t = setTimeout(onComplete, 380); return () => clearTimeout(t) }, []) // eslint-disable-line

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: 'white', border: '1px solid #EDE1D7', borderRadius: 12, padding: '16px 18px' }}>
      {data.badge && (
        <div style={{
          display: 'inline-flex', fontSize: 10, fontWeight: 600, letterSpacing: '0.4px',
          textTransform: 'uppercase', color: data.badgeColor ?? '#683D1B',
          background: `${data.badgeColor ?? '#683D1B'}12`,
          border: `1px solid ${data.badgeColor ?? '#683D1B'}20`,
          borderRadius: 6, padding: '2px 8px', marginBottom: 10,
        }}>
          {data.badge}
        </div>
      )}
      {data.title && (
        <div style={{ fontSize: 16, fontWeight: 600, color: '#26211E', lineHeight: '22px', marginBottom: data.subtitle ? 2 : 8 }}>
          {data.title}
        </div>
      )}
      {data.subtitle && (
        <div style={{ fontSize: 12, color: '#9A9089', marginBottom: 10 }}>{data.subtitle}</div>
      )}
      <div style={{ fontSize: 14, color: '#524B47', lineHeight: '22px' }}>{renderInlineMd(data.body)}</div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  AnimatedConnectorError — inline auth-failure card
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedConnectorError({
  data, onComplete, onRetry,
}: { data: ConnectorErrorData; onComplete: () => void; onRetry?: () => void }) {
  useEffect(() => { const t = setTimeout(onComplete, 420); return () => clearTimeout(t) }, []) // eslint-disable-line
  const [retryHovered, setRetryHovered] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex', gap: 14, alignItems: 'flex-start',
        background: 'rgba(195,56,56,0.04)',
        border: '1px solid rgba(195,56,56,0.18)',
        borderRadius: 12, padding: '14px 16px',
      }}>
      {/* Left stripe */}
      <div style={{ width: 3, borderRadius: 99, background: 'var(--red-500, #C33838)', flexShrink: 0, alignSelf: 'stretch', minHeight: 32 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
        {/* Top row: icon + name + badge + button */}
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 14 }}>{data.icon ?? '⚠️'}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--neutral-900)' }}>
              {data.connector}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase',
              color: 'var(--red-600, #A82E2E)', background: 'rgba(195,56,56,0.1)',
              border: '1px solid rgba(195,56,56,0.2)', borderRadius: 5, padding: '1px 6px',
              flexShrink: 0,
            }}>
              Auth expired
            </span>
          </div>
          <button
            onMouseEnter={() => setRetryHovered(true)}
            onMouseLeave={() => setRetryHovered(false)}
            onClick={onRetry}
            style={{
              flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 6,
              background: retryHovered ? 'rgba(195,56,56,0.08)' : 'white',
              border: '1px solid rgba(195,56,56,0.28)',
              borderRadius: 8, padding: '6px 12px',
              fontSize: 14, fontWeight: 600, color: 'var(--red-600, #A82E2E)',
              cursor: 'pointer', transition: 'background 140ms',
            }}>
            <HIcon icon={Exchange01Icon} size={16} color="var(--red-600, #A82E2E)" strokeWidth={1.5} />
            {data.cta}
          </button>
        </div>
        {/* Message — only when present */}
        {data.message && (
          <div style={{ fontSize: 14, color: 'var(--neutral-500)', lineHeight: '22px' }}>
            {data.message}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  AnimatedSearchTimeout — inline search-timeout card
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedSearchTimeout({
  data, onComplete, onRetry,
}: { data: SearchTimeoutData; onComplete: () => void; onRetry?: () => void }) {
  useEffect(() => { const t = setTimeout(onComplete, 420); return () => clearTimeout(t) }, []) // eslint-disable-line
  const [retryHovered, setRetryHovered] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex', gap: 14, alignItems: 'flex-start',
        background: 'rgba(162,136,71,0.05)',
        border: '1px solid rgba(162,136,71,0.22)',
        borderRadius: 12, padding: '14px 16px',
      }}>
      {/* Left stripe */}
      <div style={{ width: 3, borderRadius: 99, background: 'var(--yellow-500, #A28847)', flexShrink: 0, alignSelf: 'stretch', minHeight: 32 }} />
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
        {/* Left: icon + label + query pill */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ lineHeight: 0 }}><HIcon icon={GlobeXIcon} size={16} color="var(--yellow-700, #7A6030)" strokeWidth={1.5} /></span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--neutral-900)' }}>
              Web search timed out
            </span>
          </div>
          {/* Query pill */}
          <div style={{
            display: 'inline-flex', alignSelf: 'flex-start',
            fontSize: 13, fontFamily: 'var(--font-code)', color: 'var(--neutral-500)',
            background: 'var(--neutral-800-10)', border: '1px solid var(--neutral-700-12)',
            borderRadius: 5, padding: '2px 8px',
          }}>
            {data.query}
          </div>
        </div>
        {/* Right: retry button */}
        <button
          onMouseEnter={() => setRetryHovered(true)}
          onMouseLeave={() => setRetryHovered(false)}
          onClick={onRetry}
          style={{
            flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 6,
            background: retryHovered ? 'rgba(162,136,71,0.1)' : 'white',
            border: '1px solid rgba(162,136,71,0.32)',
            borderRadius: 8, padding: '6px 12px',
            fontSize: 14, fontWeight: 600, color: 'var(--yellow-700, #7A6030)',
            cursor: 'pointer', transition: 'background 140ms',
          }}>
          <HIcon icon={Exchange01Icon} size={16} color="var(--yellow-700, #7A6030)" strokeWidth={1.5} />
          {data.cta}
        </button>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shared text rendering helpers
// ─────────────────────────────────────────────────────────────────────────────

// renderInlineRich — used inside renderTextBlock for response text
// Supports: **bold**, `inline code`, {N} citations, [text](url) links
function renderInlineRich(line: string, citations?: Citation[]) {
  return line.split(/(\*\*[^*]+\*\*|`[^`]+`|\{\d+\}|\[[^\]]+\]\(https?:\/\/[^)]+\))/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} style={{ fontWeight: 600, color: 'var(--neutral-900)' }}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} style={INLINE_CODE_STYLE}>{part.slice(1, -1)}</code>
    const cm = part.match(/^\{(\d+)\}$/)
    if (cm) return <CitationChip key={i} n={parseInt(cm[1])} citation={citations?.[parseInt(cm[1]) - 1]} />
    const lm = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/)
    if (lm) return <a key={i} href={lm[2]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brown-500)', textDecoration: 'underline', textUnderlineOffset: 2 }}>{lm[1]}</a>
    return <span key={i}>{part}</span>
  })
}

// Detect a standalone **heading** line (bold text alone on a line, optionally with colon)
function isBoldHeading(line: string) {
  return /^\*\*[^*]+\*\*:?\s*$/.test(line.trim())
}

// renderTextBlock — full block renderer for response text
// Handles: # H1/H2/H3, - unordered lists, 1. ordered lists, > blockquotes,
//          **bold headings**, paragraphs, inline code, bold, citations
// Works during streaming (cursor appended to last element)
function renderTextBlock(text: string, citations?: Citation[], cursor?: React.ReactNode) {
  const blocks = text.split(/\n\n+/)

  // Spacing between consecutive blocks
  const GAP = 14

  return (
    <div style={{ color: 'var(--neutral-800)', fontSize: 16 }}>
      {blocks.map((block, bi) => {
        const isLast = bi === blocks.length - 1
        const tail   = isLast ? cursor : null
        // Non-empty lines only (guards against trailing \n inside a block)
        const lines  = block.split('\n').filter((l, li, arr) =>
          l.trim() !== '' || li < arr.length - 1
        )
        const first  = lines[0] ?? ''

        // ── H1 — rare in chat, only full document/report outputs
        // Uses Geist not Besley — keeps it conversational, not editorial
        if (first.startsWith('# ')) return (
          <div key={bi} style={{
            fontSize: 22, fontWeight: 700, color: 'var(--neutral-900)',
            fontFamily: 'var(--font-body)',
            lineHeight: '30px',
            marginTop: bi > 0 ? 10 : 0,
            marginBottom: isLast ? 0 : GAP + 2,
          }}>
            {renderInlineRich(first.slice(2), citations)}{tail}
          </div>
        )

        // ── H2 — section headers in a structured response
        if (first.startsWith('## ')) return (
          <div key={bi} style={{
            fontSize: 18, fontWeight: 600, color: 'var(--neutral-900)',
            fontFamily: 'var(--font-body)',
            lineHeight: '26px',
            marginTop: bi > 0 ? 8 : 0,
            marginBottom: isLast ? 0 : GAP,
          }}>
            {renderInlineRich(first.slice(3), citations)}{tail}
          </div>
        )

        // ── H3 — same size as body (16px), differentiated by weight only
        // In chat context H3 = a labelled group, not a page section
        if (first.startsWith('### ')) return (
          <div key={bi} style={{
            fontSize: 16, fontWeight: 600, color: 'var(--neutral-900)',
            fontFamily: 'var(--font-body)',
            lineHeight: '24px',
            marginTop: bi > 0 ? 6 : 0,
            marginBottom: isLast ? 0 : GAP,
          }}>
            {renderInlineRich(first.slice(4), citations)}{tail}
          </div>
        )

        // ── Blockquote — every line starts with "> "
        if (lines.length > 0 && lines.every(l => l.startsWith('> '))) return (
          <div key={bi} style={{
            borderLeft: '2.5px solid var(--neutral-200)',
            paddingLeft: 12, marginBottom: isLast ? 0 : GAP,
            color: 'var(--neutral-600)', fontStyle: 'italic',
            lineHeight: '26px',
          }}>
            {lines.map((l, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {renderInlineRich(l.slice(2), citations)}
              </React.Fragment>
            ))}
            {tail}
          </div>
        )

        // ── Unordered list — every non-empty line starts with "- " or "* "
        const nonEmpty = lines.filter(l => l.trim() !== '')
        if (nonEmpty.length > 0 && nonEmpty.every(l => /^[-*]\s/.test(l.trim()))) return (
          <ul key={bi} style={{
            margin: 0, marginBottom: isLast ? 0 : GAP,
            paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 5,
          }}>
            {nonEmpty.map((l, li) => {
              const isLastItem = li === nonEmpty.length - 1
              return (
                <li key={li} style={{ lineHeight: '24px', color: 'var(--neutral-800)', fontSize: 16 }}>
                  {renderInlineRich(l.replace(/^[-*]\s/, ''), citations)}
                  {isLastItem && tail}
                </li>
              )
            })}
          </ul>
        )

        // ── Ordered list — every non-empty line starts with "N. "
        if (nonEmpty.length > 0 && nonEmpty.every(l => /^\d+\.\s/.test(l.trim()))) return (
          <ol key={bi} style={{
            margin: 0, marginBottom: isLast ? 0 : GAP,
            paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 5,
          }}>
            {nonEmpty.map((l, li) => {
              const isLastItem = li === nonEmpty.length - 1
              return (
                <li key={li} style={{ lineHeight: '24px', color: 'var(--neutral-800)', fontSize: 16 }}>
                  {renderInlineRich(l.replace(/^\d+\.\s/, ''), citations)}
                  {isLastItem && tail}
                </li>
              )
            })}
          </ol>
        )

        // ── Bold heading line (standalone **text**)
        if (lines.length === 1 && isBoldHeading(first)) return (
          <p key={bi} style={{
            margin: 0, marginBottom: isLast ? 0 : GAP,
            lineHeight: '26px', fontWeight: 600, fontSize: 16,
            color: 'var(--neutral-900)',
          }}>
            {renderInlineRich(first, citations)}{tail}
          </p>
        )

        // ── Regular paragraph
        return (
          <p key={bi} style={{
            margin: 0, marginBottom: isLast ? 0 : GAP,
            lineHeight: '26px', fontWeight: 400, fontSize: 16,
            color: 'var(--neutral-800)',
          }}>
            {lines.map((line, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {renderInlineRich(line, citations)}
              </React.Fragment>
            ))}
            {tail}
          </p>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  StaticRenderedText — displays a completed text block as static (no stream)
// ─────────────────────────────────────────────────────────────────────────────
function StaticRenderedText({ text, citations, markdownEnabled }: {
  text: string; citations?: Citation[]; markdownEnabled: boolean
}) {
  const rendered = markdownEnabled ? text : text.replace(/\*\*/g, '')
  return renderTextBlock(rendered, citations)
}

// ─────────────────────────────────────────────────────────────────────────────
//  FollowUpRouter — invisible mount that fires follow-up prompts to parent
//  (avoids performing side-effects during render in BlockSequenceRenderer)
// ─────────────────────────────────────────────────────────────────────────────
function FollowUpRouter({
  prompts, onReady, onDone,
}: {
  prompts: string[]
  onReady: React.MutableRefObject<((prompts: string[]) => void) | undefined>
  onDone: () => void
}) {
  useEffect(() => {
    onReady.current?.(prompts)
    const t = setTimeout(onDone, 80)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
//  BlockSequenceRenderer — orchestrates sequential block reveal
//  · Text blocks stream word-by-word (active) or show static (done)
//  · Structured blocks animate on entry then call onComplete
//  · firstTokenDelay only applies to the very first block
// ─────────────────────────────────────────────────────────────────────────────
function BlockSequenceRenderer({
  blocks, firstTokenDelay, wordDelay, isPaused, onComplete, markdownEnabled, onFollowUps, onRetry,
}: {
  blocks: ResponseBlock[]
  firstTokenDelay: number
  wordDelay: number
  isPaused: boolean
  onComplete: () => void
  markdownEnabled: boolean
  onFollowUps?: (prompts: string[]) => void
  onRetry?: () => void
}) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [allDone,   setAllDone]   = useState(false)
  const onCompleteRef   = useRef(onComplete)
  const onFollowUpsRef  = useRef(onFollowUps)
  onCompleteRef.current  = onComplete
  onFollowUpsRef.current = onFollowUps

  const handleBlockDone = useCallback((idx: number) => {
    if (idx < blocks.length - 1) {
      setActiveIdx(idx + 1)
    } else {
      setAllDone(true)
      onCompleteRef.current()
    }
  }, [blocks.length])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {blocks.map((block, i) => {
        if (i > activeIdx) return null
        const isDone  = i < activeIdx || allDone
        const isFirst = i === 0
        const wrapDelay = isFirst ? firstTokenDelay : 0

        // ── text block ──────────────────────────────────────────────────────
        if (block.kind === 'text') {
          if (isDone) {
            return (
              <StaticRenderedText key={`b${i}-done`}
                text={block.content} citations={block.citations} markdownEnabled={markdownEnabled} />
            )
          }
          const txt = markdownEnabled ? block.content : block.content.replace(/\*\*/g, '')
          return (
            <StreamingText key={`b${i}-active`}
              text={txt} wordDelay={wordDelay} firstTokenDelay={wrapDelay}
              isPaused={isPaused} citations={block.citations}
              onComplete={() => handleBlockDone(i)} />
          )
        }

        // ── structured blocks — always use StructuredResponseWrapper ────────
        const wrap = (children: (done: () => void) => React.ReactNode) => (
          <StructuredResponseWrapper key={`b${i}`} firstTokenDelay={wrapDelay} onComplete={() => handleBlockDone(i)}>
            {children}
          </StructuredResponseWrapper>
        )

        if (block.kind === 'table')      return wrap(d => <AnimatedTable     data={block.data} onComplete={d} />)
        if (block.kind === 'bar-chart')  return wrap(d => <AnimatedBarChart  data={block.data} onComplete={d} />)
        if (block.kind === 'steps')      return wrap(d => <AnimatedSteps     data={block.data} onComplete={d} />)
        if (block.kind === 'code')       return wrap(d => <AnimatedCodeBlock data={block.data} onComplete={d} />)
        if (block.kind === 'callout')    return wrap(d => <AnimatedCallout   data={block.data} onComplete={d} />)
        if (block.kind === 'tags')       return wrap(d => <AnimatedTags      data={block.data} onComplete={d} />)
        if (block.kind === 'follow-ups') {
          // Render a tiny invisible trigger that fires the follow-ups callback and advances
          return (
            <FollowUpRouter key={`b${i}-fu`}
              prompts={block.data.prompts}
              onReady={onFollowUpsRef}
              onDone={() => handleBlockDone(i)} />
          )
        }
        if (block.kind === 'pie-chart')  return wrap(d => <AnimatedPieChart  data={block.data} onComplete={d} />)
        if (block.kind === 'line-chart') return wrap(d => <AnimatedLineChart data={block.data} onComplete={d} />)
        if (block.kind === 'card')       return wrap(d => <AnimatedCard      data={block.data} onComplete={d} />)
        if (block.kind === 'connector-error') return wrap(d => <AnimatedConnectorError data={block.data} onComplete={d} onRetry={onRetry} />)
        if (block.kind === 'search-timeout')  return wrap(d => <AnimatedSearchTimeout  data={block.data} onComplete={d} onRetry={onRetry} />)
        return null
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  StreamingText — with breathing dot cursor + inline citation parsing
// ─────────────────────────────────────────────────────────────────────────────
function StreamingText({
  text, wordDelay, firstTokenDelay, isPaused, citations, onComplete,
}: {
  text: string; wordDelay: number; firstTokenDelay: number
  isPaused: boolean; citations?: Citation[]; onComplete: () => void
}) {
  const words = text.split(' ')
  const [count, setCount]     = useState(0)
  const [started, setStarted] = useState(false)
  const pausedRef  = useRef(isPaused)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  pausedRef.current = isPaused

  useEffect(() => { setCount(0); setStarted(false) }, [text])
  useEffect(() => {
    const t = setTimeout(() => {
      setStarted(true)
      intervalRef.current = setInterval(() => {
        if (pausedRef.current) return
        setCount(prev => {
          if (prev >= words.length) { clearInterval(intervalRef.current!); onComplete(); return prev }
          return prev + 1
        })
      }, wordDelay)
    }, firstTokenDelay)
    return () => { clearTimeout(t); if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [text, wordDelay, firstTokenDelay]) // eslint-disable-line

  if (!started) return (
    <div style={{ height: 26, display: 'flex', alignItems: 'center' }}>
      <BreathingDot />
    </div>
  )

  const displayed = words.slice(0, count).join(' ')
  const cursor = count < words.length && !isPaused ? <BreathingDot /> : null

  return renderTextBlock(displayed, citations, cursor)
}

// ─────────────────────────────────────────────────────────────────────────────
//  UserBubble
// ─────────────────────────────────────────────────────────────────────────────
function UserBubble({ text, attachment }: { text: string; attachment?: ScenarioData['attachment'] }) {
  const [hovered, setHovered] = useState(false)
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      {attachment && (
        <div>
          <FileChip attachment={attachment} />
        </div>
      )}
      <div
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        style={{
          background: '#683D1B', color: '#FFFFFF',
          padding: '12px 16px', borderRadius: '16px 16px 4px 16px',
          boxShadow: 'inset 0px -2px 1.1px rgba(0,0,0,0.25)',
          maxWidth: 566, fontSize: 16, lineHeight: '22px', cursor: 'default',
        }}>
        {text}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, paddingRight: 2,
        opacity: hovered ? 1 : 0, pointerEvents: hovered ? 'auto' : 'none',
        transition: 'opacity 0.14s ease', height: 24,
      }}>
        <span style={{ fontSize: 11, color: '#B6ACA4' }}>{timeStr}</span>
        {([
          { label: 'Retry',  render: () => <HIcon icon={Exchange01Icon}    size={16} color="#B6ACA4" strokeWidth={1.5} /> },
          { label: 'Edit',   render: () => <HIcon icon={QuillWrite01Icon} size={16} color="#B6ACA4" strokeWidth={1.5} /> },
          { label: 'Copy',   render: () => <HIcon icon={Copy01Icon}       size={16} color="#B6ACA4" strokeWidth={1.5} /> },
        ] as { label: string; render: () => React.ReactNode }[]).map(({ label, render }) => (
          <button key={label} title={label} style={{
            width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 5,
            transition: 'background 120ms',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,54,50,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            {render()}
          </button>
        ))}
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  FeedbackModal
// ─────────────────────────────────────────────────────────────────────────────
function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [issue, setIssue] = useState('')
  const [details, setDetails] = useState('')
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(38,33,30,0.4)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 16, padding: '24px',
          width: 420, boxShadow: '0 20px 40px rgba(38,33,30,0.2), 0 0 0 1px #EDE1D7',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#26211E' }}>Give negative feedback</span>
          <span style={{ fontSize: 13, color: '#827A74' }}>What type of issue do you wish to report? (optional)</span>
        </div>
        <select value={issue} onChange={e => setIssue(e.target.value)} style={{
          width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 14,
          border: '1px solid #D1C6BD', color: issue ? '#26211E' : '#B6ACA4',
          background: 'white', outline: 'none', cursor: 'pointer',
        }}>
          <option value="">Select…</option>
          <option value="harmful">Harmful or unsafe content</option>
          <option value="untrue">Not factually correct</option>
          <option value="unhelpful">Not helpful</option>
          <option value="other">Other</option>
        </select>
        <textarea
          placeholder="What was unsatisfying about this response? (optional)"
          value={details} onChange={e => setDetails(e.target.value)}
          rows={4}
          style={{
            width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 14,
            border: '1px solid #D1C6BD', color: '#26211E', background: 'white',
            outline: 'none', resize: 'none', fontFamily: 'inherit',
            boxSizing: 'border-box',
          }} />
        <span style={{ fontSize: 11, color: '#B6ACA4', lineHeight: '16px' }}>
          Submitting this report will send the current conversation to Souvenir for review.
        </span>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid #D1C6BD',
            background: 'transparent', color: '#524B47', fontSize: 14, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: '#26211E', color: 'white', fontSize: 14, fontWeight: 500, cursor: 'pointer',
          }}>Submit</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  ActionBar
// ─────────────────────────────────────────────────────────────────────────────
function ActionBar({ visible }: { visible: boolean }) {
  const [isCopied,          setIsCopied]          = useState(false)
  const [isPinned,          setIsPinned]           = useState(false)
  const [thumbsUp,          setThumbsUp]           = useState(false)
  const [showToast,         setShowToast]          = useState(false)
  const [showFeedbackModal, setShowFeedbackModal]  = useState(false)
  // Keep visible while interacting with an active state (pinned / copied / thumbsUp)
  const hasActiveState = isPinned || isCopied || thumbsUp
  const show = visible || hasActiveState

  const handleCopy = () => {
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 1500)
  }

  const handleThumbsUp = () => {
    if (thumbsUp) return
    setThumbsUp(true)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2200)
  }

  const btnStyle = (active = false, activeColor = 'rgba(59,54,50,0.07)'): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 6, borderRadius: 7, border: 'none', cursor: 'pointer',
    background: active ? activeColor : 'transparent',
    transition: 'background 120ms',
  })

  return (
    <div style={{ position: 'relative' }}>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: show ? 1 : 0, y: show ? 0 : 2 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{ display: 'flex', gap: 2, marginTop: 4, pointerEvents: show ? 'auto' : 'none' }}>

        {/* Pin */}
        <button title={isPinned ? 'Unpin' : 'Pin'} onClick={() => setIsPinned(p => !p)}
          style={btnStyle(isPinned, 'rgba(104,61,27,0.1)')}
          onMouseEnter={e => { if (!isPinned) e.currentTarget.style.background = 'rgba(59,54,50,0.07)' }}
          onMouseLeave={e => { e.currentTarget.style.background = isPinned ? 'rgba(104,61,27,0.1)' : 'transparent' }}>
          <HIcon icon={Bookmark01Icon} size={18} color={isPinned ? '#683D1B' : '#A09890'} strokeWidth={1.5} />
        </button>

        {/* Copy */}
        <button title="Copy" onClick={handleCopy}
          style={btnStyle(isCopied, 'rgba(128,183,7,0.08)')}
          onMouseEnter={e => { if (!isCopied) e.currentTarget.style.background = 'rgba(59,54,50,0.07)' }}
          onMouseLeave={e => { e.currentTarget.style.background = isCopied ? 'rgba(128,183,7,0.08)' : 'transparent' }}>
          {isCopied
            ? <HIcon icon={Checkmark} size={18} color="#80B707" strokeWidth={2.5} />
            : <HIcon icon={Copy01Icon} size={18} color="#A09890" strokeWidth={1.5} />}
        </button>

        {/* Thumbs up */}
        <button title="Helpful" onClick={handleThumbsUp}
          style={btnStyle(thumbsUp, 'rgba(128,183,7,0.08)')}
          onMouseEnter={e => { if (!thumbsUp) e.currentTarget.style.background = 'rgba(59,54,50,0.07)' }}
          onMouseLeave={e => { e.currentTarget.style.background = thumbsUp ? 'rgba(128,183,7,0.08)' : 'transparent' }}>
          <HIcon icon={ThumbsUpIcon} size={18} color={thumbsUp ? '#80B707' : '#A09890'} strokeWidth={1.5} />
        </button>

        {/* Thumbs down */}
        <button title="Not helpful" onClick={() => setShowFeedbackModal(true)}
          style={btnStyle()}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,54,50,0.07)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <HIcon icon={ThumbsDownIcon} size={18} color="#A09890" strokeWidth={1.5} />
        </button>

        {/* Retry */}
        <button title="Retry"
          style={btnStyle()}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,54,50,0.07)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <HIcon icon={Exchange01Icon} size={18} color="#A09890" strokeWidth={1.5} />
        </button>
      </motion.div>

      {/* Thumbs-up toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute', top: -36, left: 0,
              background: '#26211E', color: 'white',
              fontSize: 12, fontWeight: 500,
              padding: '6px 12px', borderRadius: 8,
              pointerEvents: 'none', whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}>
            Thanks for the feedback 👍
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feedback modal */}
      <AnimatePresence>
        {showFeedbackModal && <FeedbackModal onClose={() => setShowFeedbackModal(false)} />}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  Control panel primitives
// ─────────────────────────────────────────────────────────────────────────────
function Slider({ label, value, min, max, step = 1, unit = 'ms', onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#524B47' }}>
        <span>{label}</span><span style={{ fontWeight: 600, color: '#26211E' }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#683D1B', height: 4 }} />
    </div>
  )
}

function Toggle({ label, value, hint, onColor, onChange }: {
  label: string; value: boolean; hint?: string; onColor?: string; onChange: (v: boolean) => void
}) {
  const activeColor = onColor ?? '#683D1B'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
      <div>
        <div style={{ fontSize: 12, color: '#524B47' }}>{label}</div>
        {hint && <div style={{ fontSize: 10, color: '#B6ACA4', marginTop: 1 }}>{hint}</div>}
      </div>
      <button onClick={() => onChange(!value)} style={{
        width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', flexShrink: 0,
        background: value ? activeColor : '#D1C6BD', position: 'relative', transition: 'background 200ms',
      }}>
        <motion.div animate={{ x: value ? 14 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          style={{ position: 'absolute', top: 2, width: 14, height: 14, borderRadius: '50%', background: 'white' }} />
      </button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 10, color: '#827A74', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>{title}</div>
      {children}
    </div>
  )
}

function delay(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

// ─────────────────────────────────────────────────────────────────────────────
//  FrozenTurn — a completed exchange rendered statically above the live turn
// ─────────────────────────────────────────────────────────────────────────────
interface FrozenTurn {
  id: number
  query: string
  attachment?: ScenarioData['attachment']
  modelName: string
  modelLlmId: string
  // Text response (text / streaming scenarios)
  responseText?: string
  citations?: Citation[]
  // Block sequence response
  responseBlocks?: ResponseBlock[]
  isBlocks: boolean
}

function FrozenTurnView({ turn }: { turn: FrozenTurn }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* User bubble — static, no enter animation */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        {turn.attachment && (
          <div><FileChip attachment={turn.attachment} /></div>
        )}
        <div style={{
          background: '#683D1B', color: '#FFFFFF',
          padding: '12px 16px', borderRadius: '16px 16px 4px 16px',
          boxShadow: 'inset 0px -2px 1.1px rgba(0,0,0,0.25)',
          maxWidth: 566, fontSize: 16, lineHeight: '22px',
        }}>
          {turn.query}
        </div>
      </div>

      {/* AI response — static */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: 0.82 }}>
        {/* Mini model row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <LlmIcon id={turn.modelLlmId} size={14} variant="color" />
          <span style={{ fontSize: 13, color: '#827A74', fontWeight: 500 }}>{turn.modelName}</span>
        </div>

        {/* Response content */}
        {turn.isBlocks && turn.responseBlocks ? (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', borderRadius: 8,
            background: 'rgba(59,54,50,0.05)', border: '1px solid var(--neutral-100)',
            fontSize: 13, color: '#827A74',
          }}>
            <span>Structured response</span>
            <span style={{ color: 'var(--neutral-300)' }}>·</span>
            <span>{turn.responseBlocks.filter(b => b.kind !== 'text').map(b => b.kind).filter((v, i, a) => a.indexOf(v) === i).join(', ')}</span>
          </div>
        ) : turn.responseText ? (
          <div style={{ fontSize: 16, color: 'var(--neutral-800)', lineHeight: '26px' }}>
            {renderTextBlock(turn.responseText, turn.citations)}
          </div>
        ) : null}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--neutral-100)', marginTop: 4 }} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main
// ─────────────────────────────────────────────────────────────────────────────
export default function ChatPreview() {
  // Config
  const [scenarioId,      setScenarioId]       = useState('S3')
  const [selectedModel,   setSelectedModel]    = useState('Claude')
  const [wordDelay,       setWordDelay]        = useState(28)
  const [firstTokenDelay, setFirstTokenDelay]  = useState(120)
  const [thinkDuration,   setThinkDuration]    = useState(650)
  const [choosingDuration,setChoosingDuration] = useState(1100)
  const [sourceStagger,   setSourceStagger]    = useState(380)
  const [resultStagger,   setResultStagger]    = useState(75)
  const [collapseDelay,   setCollapseDelay]    = useState(520)
  const [showReasoning,   setShowReasoning]    = useState(true)
  const [showActionBar,   setShowActionBar]    = useState(true)
  const [markdownEnabled, setMarkdownEnabled]  = useState(true)
  // Sub-variant pickers for S10 (table showcase) and S11 (chart showcase)
  const [s10Variant,      setS10Variant]       = useState<string>('basic')
  const [s11Variant,      setS11Variant]       = useState<string>('vertical')
  // Follow-up prompts — populated by BlockSequenceRenderer when it hits a follow-ups block
  const [followUpPrompts, setFollowUpPrompts]  = useState<string[]>([])

  // Runtime
  const [phase,               setPhase]               = useState<Phase>('idle')
  const [label,               setLabel]               = useState('Souvenir')
  const [isResearchOpen,      setIsResearchOpen]       = useState(false)
  const [researchTitleVisible,setResearchTitleVisible] = useState(false)
  const [liveResearchTitle,   setLiveResearchTitle]    = useState<string | null>(null)
  const [reasoningCount,      setReasoningCount]       = useState(0)
  const [expandedReasoningIdxs,setExpandedReasoningIdxs] = useState<Set<number>>(new Set())
  const [thinkingExpanded,    setThinkingExpanded]     = useState(false)
  const [activitiesRevealed,  setActivitiesRevealed]   = useState(0)
  const [resultsRevealed,     setResultsRevealed]      = useState<number[]>([])
  const [readingResults,      setReadingResults]        = useState<Set<string>>(new Set())
  const [completedGroupCount, setCompletedGroupCount]  = useState(0)
  const [expandedGroupIdx,    setExpandedGroupIdx]     = useState<number | null>(null)
  const [isPaused,            setIsPaused]             = useState(false)
  const [interrupted,         setInterrupted]          = useState(false)
  const [isComplete,          setIsComplete]           = useState(false)
  const [responseHovered,     setResponseHovered]      = useState(false)
  const [selectionRect,       setSelectionRect]        = useState<DOMRect | null>(null)
  const [selectedText,        setSelectedText]         = useState<string>('')
  const [selectionPinned,     setSelectionPinned]      = useState(false)

  const [completedTurns,      setCompletedTurns]       = useState<FrozenTurn[]>([])
  const [pendingQuery,        setPendingQuery]         = useState<string | null>(null)

  const runId            = useRef(0)
  const responseAreaRef  = useRef<HTMLDivElement>(null)
  const chatScrollRef    = useRef<HTMLDivElement>(null)
  const readingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const modelRef         = useRef(MODEL_OPTIONS[0])
  const scenario = SCENARIOS.find(s => s.id === scenarioId) ?? SCENARIOS[0]
  const model    = MODEL_OPTIONS.find(m => m.id === selectedModel) ?? MODEL_OPTIONS[0]
  modelRef.current = model
  // For multi-turn: follow-up clicks override the displayed query and clear the attachment
  const currentQuery      = pendingQuery ?? scenario.userQuery
  const currentAttachment = pendingQuery ? undefined : scenario.attachment

  const reset = useCallback(() => {
    runId.current++
    setPhase('idle'); setLabel('Souvenir')
    setIsResearchOpen(false); setResearchTitleVisible(false); setLiveResearchTitle(null)
    setReasoningCount(0); setExpandedReasoningIdxs(new Set()); setThinkingExpanded(false)
    setActivitiesRevealed(0); setResultsRevealed([])
    readingTimersRef.current.forEach(t => clearTimeout(t))
    readingTimersRef.current.clear()
    setReadingResults(new Set())
    setCompletedGroupCount(0); setExpandedGroupIdx(null)
    setIsPaused(false); setInterrupted(false); setIsComplete(false)
    setFollowUpPrompts([])
  }, [])

  // Re-run when model changes after mount
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    setCompletedTurns([])
    setPendingQuery(null)
    run()
  }, [selectedModel]) // eslint-disable-line

  // Text selection → floating "Highlight" CTA
  useEffect(() => {
    const handleMouseUp = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setSelectionRect(null); setSelectedText(''); return
      }
      if (!responseAreaRef.current) return
      const range = sel.getRangeAt(0)
      // Only show CTA when selection is inside the response area
      if (!responseAreaRef.current.contains(range.commonAncestorContainer)) {
        setSelectionRect(null); setSelectedText(''); return
      }
      setSelectionRect(range.getBoundingClientRect())
      setSelectedText(sel.toString().trim())
      setSelectionPinned(false)
    }
    const handleMouseDown = (e: MouseEvent) => {
      // Dismiss unless clicking within the CTA itself
      const cta = document.getElementById('selection-cta')
      if (cta && cta.contains(e.target as Node)) return
      setSelectionRect(null); setSelectedText('')
    }
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [])

  // Auto-scroll to bottom during streaming and when turns are added
  useEffect(() => {
    const el = chatScrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: completedTurns.length > 0 ? 'smooth' : 'instant' })
  }, [completedTurns, phase])

  const run = useCallback(async () => {
    reset()
    const id = ++runId.current
    const ok = () => id === runId.current
    const sc = SCENARIOS.find(s => s.id === scenarioId) ?? SCENARIOS[0]

    await delay(80); if (!ok()) return
    setPhase('user-sent')
    await delay(320); if (!ok()) return

    setPhase('souvenir'); setLabel('Souvenir')

    // S1: instant — skip routing
    if (sc.skipRouting) {
      await delay(480); if (!ok()) return
      setPhase('streaming')
      return
    }

    // Thinking + choosing
    await delay(480); if (!ok()) return
    setPhase('thinking'); setLabel('Thinking…')
    await delay(thinkDuration); if (!ok()) return

    setPhase('choosing'); setLabel('Choosing the best model…')
    await delay(choosingDuration); if (!ok()) return

    setPhase('model-chosen')
    setLabel(modelRef.current.name)
    await delay(680); if (!ok()) return

    // Research / activities
    const hasVisibleContent = sc.hasActivities || (sc.reasoningSteps.length > 0 && showReasoning)
    if (sc.hasActivities || sc.reasoningSteps.length > 0) {
      if (hasVisibleContent) setIsResearchOpen(true)
      setPhase('researching')

      const totalReasoning = sc.reasoningSteps.length

      // Helper: run all activities with live title cycling
      const runActivities = async () => {
        if (!sc.hasActivities) return
        // Planning micro-beat before first action
        setResearchTitleVisible(true)
        setLiveResearchTitle('Planning…')
        await delay(850); if (!ok()) return
        // First activity verb
        setLiveResearchTitle(ACTIVITY_VERB[sc.activities[0].type] + '…')

        let globalActivityIdx = 0
        for (let gi = 0; gi < Math.max(sc.actionGroups.length, 1); gi++) {
          const groupSize = sc.actionGroups[gi]?.activityCount ?? sc.activities.length
          for (let ai = 0; ai < groupSize && globalActivityIdx < sc.activities.length; ai++, globalActivityIdx++) {
            await delay(sourceStagger); if (!ok()) return
            setActivitiesRevealed(globalActivityIdx + 1)
            // Advance title to next activity verb
            const next = globalActivityIdx + 1
            if (next < sc.activities.length) {
              setLiveResearchTitle(ACTIVITY_VERB[sc.activities[next].type] + '…')
            }
            const activityResults = sc.activities[globalActivityIdx].results ?? []
            for (let ri = 0; ri < activityResults.length; ri++) {
              await delay(resultStagger); if (!ok()) return
              setResultsRevealed(prev => { const n = [...prev]; n[globalActivityIdx] = ri + 1; return n })
              const rKey = `${globalActivityIdx}-${ri}`
              setReadingResults(prev => new Set([...prev, rKey]))
              const rTimer = setTimeout(() => {
                setReadingResults(prev => { const next = new Set(prev); next.delete(rKey); return next })
                readingTimersRef.current.delete(rKey)
              }, 650)
              readingTimersRef.current.set(rKey, rTimer)
            }
          }
          if (sc.actionGroups.length > 0) {
            await delay(collapseDelay); if (!ok()) return
            setCompletedGroupCount(gi + 1)
          }
        }
        // Synthesising beat
        setLiveResearchTitle('Synthesising…')
        await delay(950); if (!ok()) return
        // Final title
        if (sc.researchTitle) {
          setLiveResearchTitle(sc.researchTitle)
          await delay(400); if (!ok()) return
        }
      }

      // Helper: reveal reasoning steps
      const runReasoning = async () => {
        if (!showReasoning) return
        for (let r = 0; r < totalReasoning; r++) {
          await delay(sourceStagger * 2); if (!ok()) return
          setReasoningCount(r + 1)
        }
      }

      if (sc.activitiesFirst) {
        // S6 pattern: activities (pin reading) first, then reasoning (connecting dots)
        await runActivities(); if (!ok()) return
        await runReasoning(); if (!ok()) return
      } else {
        // Default: reasoning first, then activities
        await runReasoning(); if (!ok()) return
        await runActivities(); if (!ok()) return
        // Reasoning-only scenarios (S2): show title immediately
        if (!sc.hasActivities && sc.researchTitle && hasVisibleContent) {
          setResearchTitleVisible(true)
          setLiveResearchTitle(sc.researchTitle)
        }
      }

      await delay(collapseDelay); if (!ok()) return
    }

    setIsResearchOpen(false)
    // Wait for collapse animation to finish before streaming starts (~380ms height + 60ms buffer)
    await delay(440); if (!ok()) return
    setPhase('streaming')
  }, [scenarioId, thinkDuration, choosingDuration, sourceStagger, resultStagger, collapseDelay, showReasoning, reset]) // eslint-disable-line

  // Multi-turn: archive current exchange → optionally switch scenario → run next turn
  const handleSendNext = useCallback((followUpQuery?: string, nextScenarioId?: string) => {
    if (isComplete) {
      const sc = SCENARIOS.find(s => s.id === scenarioId) ?? SCENARIOS[0]
      const displayQuery = pendingQuery ?? sc.userQuery
      const frozen: FrozenTurn = {
        id: Date.now(),
        query: displayQuery,
        attachment: pendingQuery ? undefined : sc.attachment,
        modelName: modelRef.current.name,
        modelLlmId: modelRef.current.llmId,
        responseText: sc.response || undefined,
        citations: sc.citations,
        responseBlocks: sc.responseBlocks as ResponseBlock[] | undefined,
        isBlocks: !!(sc.responseBlocks && sc.responseBlocks.length > 0),
      }
      setCompletedTurns(prev => [...prev, frozen])
    }
    setPendingQuery(followUpQuery ?? null)
    if (nextScenarioId) setScenarioId(nextScenarioId)
    run()
  }, [isComplete, scenarioId, pendingQuery, run]) // eslint-disable-line

  const handlePause = () => {
    if (phase !== 'streaming') return
    // Block sequences and structured outputs can't be paused mid-animation
    if (scenario.responseBlocks) return
    if (scenario.responseType && scenario.responseType !== 'text') return
    setIsPaused(p => { if (!p) setInterrupted(true); return !p })
  }

  const isGenerating = ['souvenir','thinking','choosing','model-chosen','researching','streaming'].includes(phase)
  const responseText = markdownEnabled ? scenario.response : scenario.response.replace(/\*\*/g, '')
  const isStructured = !!(scenario.responseBlocks) || !!(scenario.responseType && scenario.responseType !== 'text')
  const hasErrorBlock = !!(scenario.responseBlocks?.some(b => b.kind === 'connector-error' || b.kind === 'search-timeout'))
  const handleResponseComplete = () => { setIsComplete(true); setPhase('complete') }

  function renderResponse() {
    // ── S10 showcase: use TABLE_VARIANTS[s10Variant] ───────────────────────
    if (scenario.id === 'S10') {
      const vEntry = TABLE_VARIANTS[s10Variant] ?? TABLE_VARIANTS.basic
      return (
        <StructuredResponseWrapper firstTokenDelay={firstTokenDelay} onComplete={handleResponseComplete}>
          {(done) => <AnimatedTable data={vEntry.data} onComplete={done} />}
        </StructuredResponseWrapper>
      )
    }
    // ── S11 showcase: use CHART_VARIANTS[s11Variant] ───────────────────────
    if (scenario.id === 'S11') {
      const vEntry = CHART_VARIANTS[s11Variant] ?? CHART_VARIANTS.vertical
      return (
        <StructuredResponseWrapper firstTokenDelay={firstTokenDelay} onComplete={handleResponseComplete}>
          {(done) => <AnimatedBarChart data={vEntry.data} onComplete={done} />}
        </StructuredResponseWrapper>
      )
    }
    // ── New: responseBlocks takes priority (mixed content model) ───────────
    if (scenario.responseBlocks && scenario.responseBlocks.length > 0) {
      return (
        <BlockSequenceRenderer
          blocks={scenario.responseBlocks}
          firstTokenDelay={firstTokenDelay}
          wordDelay={wordDelay}
          isPaused={isPaused}
          onComplete={handleResponseComplete}
          markdownEnabled={markdownEnabled}
          onFollowUps={setFollowUpPrompts}
          onRetry={() => { reset(); run() }}
        />
      )
    }
    // ── Legacy: responseType + openUIData (S12) ────────────────────────────
    const type = scenario.responseType ?? 'text'
    if (type === 'table' && scenario.openUIData) {
      return (
        <StructuredResponseWrapper firstTokenDelay={firstTokenDelay} onComplete={handleResponseComplete}>
          {(done) => <AnimatedTable data={scenario.openUIData as TableData} onComplete={done} />}
        </StructuredResponseWrapper>
      )
    }
    if (type === 'bar-chart' && scenario.openUIData) {
      return (
        <StructuredResponseWrapper firstTokenDelay={firstTokenDelay} onComplete={handleResponseComplete}>
          {(done) => <AnimatedBarChart data={scenario.openUIData as BarChartData} onComplete={done} />}
        </StructuredResponseWrapper>
      )
    }
    if (type === 'steps' && scenario.openUIData) {
      return (
        <StructuredResponseWrapper firstTokenDelay={firstTokenDelay} onComplete={handleResponseComplete}>
          {(done) => <AnimatedSteps data={scenario.openUIData as StepsData} onComplete={done} />}
        </StructuredResponseWrapper>
      )
    }
    // Default: streaming text
    return (
      <StreamingText
        text={responseText} wordDelay={wordDelay} firstTokenDelay={firstTokenDelay}
        isPaused={isPaused} citations={scenario.citations}
        onComplete={handleResponseComplete}
      />
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F7F2ED', fontFamily: 'Geist, system-ui, -apple-system, sans-serif' }}>
      <style>{`
        @keyframes svLabelShimmer { 0% { background-position: 200% center; } 100% { background-position: -200% center; } }
      `}</style>

      {/* ── Chat area ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px 40px 24px', gap: 24, maxWidth: 860, margin: '0 auto', width: '100%' }}>

        <div style={{ fontSize: 10, color: '#C0B5AD', letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 500 }}>
          B1 · AI Responding — {scenario.name}
        </div>

        <div ref={chatScrollRef} style={{
          flex: 1, display: 'flex', flexDirection: 'column', gap: 24,
          overflowY: 'auto', paddingBottom: 8,
          overscrollBehaviorY: 'contain',
        }}>

          {/* ── Frozen turns (completed exchanges) ─────────────────────────── */}
          {completedTurns.map(turn => (
            <FrozenTurnView key={turn.id} turn={turn} />
          ))}

          <AnimatePresence>
            {phase !== 'idle' && (
              <UserBubble text={currentQuery} attachment={currentAttachment} />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {phase !== 'idle' && phase !== 'user-sent' && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                onMouseEnter={() => setResponseHovered(true)}
                onMouseLeave={() => setResponseHovered(false)}
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                <ModelRow
                  phase={phase} label={label} model={model} skipRouting={scenario.skipRouting}
                  researchTitleVisible={researchTitleVisible} researchTitle={liveResearchTitle}
                  isResearchOpen={isResearchOpen} hasResearch={scenario.hasActivities || (scenario.reasoningSteps.length > 0 && showReasoning)}
                  onToggle={() => setIsResearchOpen(o => !o)}
                />

                <ResearchBlock
                  isOpen={isResearchOpen} scenario={scenario} showReasoning={showReasoning}
                  reasoningCount={reasoningCount} expandedReasoningIdxs={expandedReasoningIdxs}
                  thinkingExpanded={thinkingExpanded}
                  onToggleReasoning={(i) => setExpandedReasoningIdxs(prev => {
                    const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next
                  })}
                  onToggleThinking={() => setThinkingExpanded(o => !o)}
                  activitiesRevealed={activitiesRevealed} resultsRevealed={resultsRevealed}
                  readingResults={readingResults}
                  completedGroupCount={completedGroupCount} expandedGroupIdx={expandedGroupIdx}
                  onToggleGroup={(i) => setExpandedGroupIdx(prev => prev === i ? null : i)}
                />

                <AnimatePresence>
                  {(phase === 'streaming' || phase === 'complete') && (
                    <motion.div ref={responseAreaRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      {renderResponse()}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Interrupt UI — only for streaming text, not structured outputs */}
                <AnimatePresence>
                  {!isStructured && interrupted && isPaused && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#827A74' }}>
                      <span>Response interrupted.</span>
                      <button onClick={() => { setIsPaused(false); setInterrupted(false) }}
                        style={{ color: '#683D1B', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>
                        Continue →
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Source list — appears after complete for research scenarios */}
                <AnimatePresence>
                  {isComplete && scenario.citations && scenario.citations.length > 0 && (
                    <SourceList key="source-list" citations={scenario.citations} />
                  )}
                </AnimatePresence>

                {isComplete && showActionBar && !hasErrorBlock && <ActionBar visible={responseHovered} />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Chat input — transforms to follow-up suggestions when available */}
        <div style={{
          background: 'white', borderRadius: 20,
          boxShadow: '0 2px 3px rgba(82,75,71,0.1), 0 0 0 1px rgba(59,54,50,0.09)',
          overflow: 'hidden',
        }}>
          <AnimatePresence mode="wait">
            {isComplete && followUpPrompts.length > 0 ? (
              /* ── Follow-up mode ─────────────────────────────────────────── */
              <motion.div key="followups"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                style={{ padding: '14px 18px 10px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--neutral-300)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
                  What would you like to explore?
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {followUpPrompts.map((prompt, i) => (
                    <motion.button key={i}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1], delay: i * 0.08 }}
                      onClick={() => {
                        const idx = SCENARIOS.findIndex(s => s.id === scenarioId)
                        const next = SCENARIOS[(idx + 1) % SCENARIOS.length]
                        handleSendNext(prompt, next.id)
                      }}
                      style={{
                        textAlign: 'left', background: 'var(--neutral-50)',
                        border: '1px solid var(--neutral-100)',
                        borderRadius: 12, padding: '10px 14px',
                        fontSize: 14, color: 'var(--neutral-700)',
                        cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'border-color 120ms, background 120ms',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--neutral-300)'; e.currentTarget.style.background = 'var(--neutral-white)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--neutral-100)'; e.currentTarget.style.background = 'var(--neutral-50)' }}>
                      <span style={{ lineHeight: '20px' }}>{prompt}</span>
                      <span style={{ color: 'var(--neutral-300)', fontSize: 16, flexShrink: 0, lineHeight: 1 }}>↗</span>
                    </motion.button>
                  ))}
                </div>
                {/* Text input row below suggestions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--neutral-100)' }}>
                  <span style={{ flex: 1, fontSize: 14, color: 'var(--neutral-300)' }}>Or ask something else…</span>
                  <button onClick={() => handleSendNext()} style={{
                    width: 30, height: 30, borderRadius: 9, border: 'none', cursor: 'pointer',
                    background: 'var(--neutral-100)', color: 'var(--neutral-500)',
                    fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>↑</button>
                </div>
              </motion.div>
            ) : (
              /* ── Default input mode ─────────────────────────────────────── */
              <motion.div key="default"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ padding: '14px 18px' }}>
                {scenario.attachment && phase === 'idle' && (
                  <div style={{ marginBottom: 10 }}>
                    <FileChip attachment={scenario.attachment} />
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ flex: 1, fontSize: 14, color: 'var(--neutral-300)' }}>
                    {isGenerating && !isPaused ? 'Souvenir is thinking…' : 'Ask anything…'}
                  </span>
                  <button
                    onClick={phase === 'streaming' && !isStructured ? handlePause : () => handleSendNext()}
                    style={{
                      width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: isComplete ? 'var(--neutral-100)' : 'var(--brown-700)', color: 'white',
                      fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 200ms',
                    }}>
                    {isPaused ? '▶' : (phase === 'streaming' && !isStructured) ? '⏸' : '↑'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Control Panel ────────────────────────────────────────────────────── */}
      <div style={{
        width: 300, background: 'white', borderLeft: '1px solid #EDE1D7',
        padding: '24px 18px', display: 'flex', flexDirection: 'column', gap: 20,
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#26211E', letterSpacing: '-0.2px' }}>Control Panel</div>

        {/* Scenario */}
        <Section title="Scenario">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {SCENARIOS.map(sc => (
              <button key={sc.id} onClick={() => { setScenarioId(sc.id); setCompletedTurns([]); setPendingQuery(null); reset() }} style={{
                padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                textAlign: 'left', fontSize: 12,
                background: scenarioId === sc.id ? '#683D1B' : 'rgba(59,54,50,0.05)',
                color: scenarioId === sc.id ? 'white' : '#524B47',
              }}>
                <div style={{ fontWeight: scenarioId === sc.id ? 600 : 500 }}>{sc.id} · {sc.name}</div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 1 }}>{sc.description}</div>
              </button>
            ))}
          </div>
        </Section>

        {/* S10 Table sub-variants — contextual, shown only when S10 is selected */}
        {scenarioId === 'S10' && (
          <Section title="Table variant">
            <div style={{ fontSize: 10, color: '#B6ACA4', marginTop: -4 }}>9 table types — pick and re-trigger</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {Object.entries(TABLE_VARIANTS).map(([key, entry]) => (
                <button key={key}
                  onClick={() => { setS10Variant(key); reset() }}
                  style={{
                    padding: '7px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                    textAlign: 'left', fontSize: 12,
                    background: s10Variant === key ? 'rgba(104,61,27,0.12)' : 'rgba(59,54,50,0.04)',
                    color: s10Variant === key ? '#683D1B' : '#524B47',
                    fontWeight: s10Variant === key ? 600 : 400,
                  }}>
                  <div>{entry.label}</div>
                  <div style={{ fontSize: 10, opacity: 0.65, marginTop: 1 }}>{entry.description}</div>
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* S11 Chart sub-variants — contextual, shown only when S11 is selected */}
        {scenarioId === 'S11' && (
          <Section title="Chart variant">
            <div style={{ fontSize: 10, color: '#B6ACA4', marginTop: -4 }}>6 chart types — pick and re-trigger</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {Object.entries(CHART_VARIANTS).map(([key, entry]) => (
                <button key={key}
                  onClick={() => { setS11Variant(key); reset() }}
                  style={{
                    padding: '7px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                    textAlign: 'left', fontSize: 12,
                    background: s11Variant === key ? 'rgba(104,61,27,0.12)' : 'rgba(59,54,50,0.04)',
                    color: s11Variant === key ? '#683D1B' : '#524B47',
                    fontWeight: s11Variant === key ? 600 : 400,
                  }}>
                  <div>{entry.label}</div>
                  <div style={{ fontSize: 10, opacity: 0.65, marginTop: 1 }}>{entry.description}</div>
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Model */}
        <Section title="AI Model">
          <div style={{ fontSize: 10, color: '#B6ACA4', marginTop: -4 }}>Re-triggers sequence</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {MODEL_OPTIONS.map(m => (
              <button key={m.id} onClick={() => setSelectedModel(m.id)} style={{
                padding: '6px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                textAlign: 'left', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
                fontWeight: selectedModel === m.id ? 600 : 400,
                background: selectedModel === m.id ? 'rgba(104,61,27,0.1)' : 'transparent',
                color: selectedModel === m.id ? '#683D1B' : '#524B47',
              }}>
                <span style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LlmIcon id={m.llmId} size={14} variant="color" />
                </span>
                {m.name}
              </button>
            ))}
          </div>
        </Section>

        {/* Actions */}
        <Section title="Actions">
          <button onClick={run} style={{
            padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: '#26211E', color: 'white', fontSize: 13, fontWeight: 500,
          }}>▶ Trigger sequence</button>
          <button onClick={reset} style={{
            padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(59,54,50,0.15)',
            cursor: 'pointer', background: 'transparent', color: '#524B47', fontSize: 13,
          }}>↺ Reset</button>
          {phase === 'streaming' && !isStructured && (
            <button onClick={handlePause} style={{
              padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: isPaused ? '#683D1B' : '#EDE1D7',
              color: isPaused ? 'white' : '#524B47', fontSize: 13,
            }}>{isPaused ? '▶ Resume' : '⏸ Pause mid-stream'}</button>
          )}
        </Section>

        {/* Timing */}
        <Section title="Timing">
          <Slider label="Think duration"    value={thinkDuration}    min={200}  max={2000} step={50}  onChange={setThinkDuration} />
          <Slider label="Choosing duration" value={choosingDuration} min={400}  max={3000} step={50}  onChange={setChoosingDuration} />
          <Slider label="Word delay"        value={wordDelay}        min={5}    max={120}              onChange={setWordDelay} />
          <Slider label="First token delay" value={firstTokenDelay}  min={0}    max={1500} step={50}  onChange={setFirstTokenDelay} />
          <Slider label="Source stagger"    value={sourceStagger}    min={50}   max={600}              onChange={setSourceStagger} />
          <Slider label="Result stagger"    value={resultStagger}    min={15}   max={200}              onChange={setResultStagger} />
          <Slider label="Collapse delay"    value={collapseDelay}    min={0}    max={1500} step={50}  onChange={setCollapseDelay} />
        </Section>

        {/* Toggles */}
        <Section title="Display">
          <Toggle label="Adaptive Thinking" hint="ON = reasoning shown · OFF = action layer only"
            onColor="#0D6EB2" value={showReasoning} onChange={setShowReasoning} />
          <Toggle label="Render markdown" hint="Bold headers in response" value={markdownEnabled} onChange={setMarkdownEnabled} />
          <Toggle label="Show action bar" hint="Copy, retry, pin after complete" value={showActionBar} onChange={setShowActionBar} />
        </Section>

        {/* State readout */}
        <Section title="Current State">
          <div style={{
            padding: '8px 12px', borderRadius: 8, background: 'rgba(59,54,50,0.04)',
            fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3, fontFamily: 'monospace',
          }}>
            <div>phase: <strong>{phase}</strong></div>
            <div>scenario: <strong>{scenario.id}</strong></div>
            <div>model: <strong>{model.name}</strong></div>
            <div>output: <strong>{scenario.responseBlocks ? `blocks(${scenario.responseBlocks.length})` : (scenario.responseType ?? 'text')}</strong></div>
            {scenario.hasActivities && <div>activities: <strong>{activitiesRevealed}/{scenario.activities.length}</strong></div>}
            {scenario.actionGroups.length > 0 && <div>groups done: <strong>{completedGroupCount}/{scenario.actionGroups.length}</strong></div>}
            {showReasoning && <div>reasoning: <strong>{reasoningCount}/{scenario.reasoningSteps.length}</strong></div>}
            {isPaused && <div style={{ color: '#683D1B' }}>⏸ paused</div>}
            {isComplete && <div style={{ color: '#80B707' }}>✓ complete</div>}
          </div>
        </Section>

        {/* KDS debt tracker */}
        <Section title="KDS Components Needed">
          <div style={{ fontSize: 10, color: '#B6ACA4', lineHeight: '15px' }}>
            When ready to port to Kaya DS:<br />
            · ActivityRow → KDS molecule<br />
            · ReasoningStep → KDS molecule<br />
            · ResearchBlock → KDS organism<br />
            · ActionGroup → KDS molecule<br />
            · FileChip → extend Chip<br />
            · CitationChip → extend Chip<br />
            · BreathingDot → StreamingCursor token<br />
            · ActionBadge → extend Badge<br />
            · AnimatedTable → KDS DataTable<br />
            · AnimatedBarChart → KDS BarChart<br />
            · AnimatedPieChart → KDS DonutChart<br />
            · AnimatedLineChart → KDS LineChart<br />
            · AnimatedSteps → KDS StepList<br />
            · AnimatedCodeBlock → KDS CodeBlock<br />
            · AnimatedCallout → KDS Callout<br />
            · AnimatedTags → KDS TagCloud<br />
            · AnimatedCard → KDS InfoCard<br />
            · BlockSequenceRenderer → KDS ResponseCanvas
          </div>
        </Section>
      </div>

      {/* ── Selection CTA — fixed floating, rendered outside chat scroll ── */}
      <AnimatePresence>
        {selectionRect && selectedText && (
          <SelectionCTA
            rect={selectionRect}
            pinned={selectionPinned}
            onPin={() => {
              setSelectionPinned(true)
              setTimeout(() => {
                setSelectionRect(null)
                setSelectedText('')
                setSelectionPinned(false)
                window.getSelection()?.removeAllRanges()
              }, 1200)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
