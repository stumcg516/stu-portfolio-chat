---
title: "PicnicHealth — SCOPE Data Analytics Platform"
slug: "picnichealth-scope"
tags: ["picnichealth", "enterprise", "analytics", "scope", "b2b", "self-service"]
updated: "2025-11-11"
summary: "Led design for SCOPE, PicnicHealth’s first enterprise-facing analytics platform. Delivered self-service reporting and querying tools that cut research turnaround times by 60% and enabled new enterprise offerings."
priority: high
---

# TL;DR  
SCOPE was PicnicHealth’s first enterprise web app — a self-service analytics platform that let customers and internal teams query patient data, build reports, and reduce dependence on the data science team.  
Stu led design from discovery through launch, balancing expert-grade power with approachability for non-technical users. The platform improved efficiency, reduced bottlenecks, and became the foundation for PicnicHealth’s B2B expansion.

---

## Context & Overview  
As a data vendor, PicnicHealth’s key success metric was **“Time to Insight”** — how quickly a researcher could ask a question of the data and get a usable answer.  
Historically, all requests were routed through a small analytics team, which became a bottleneck as customer demand grew.  
Stu’s team was tasked with developing **self-service analytics tools** for both internal and external (enterprise) users — allowing them to query and visualize data independently.

**Role & Tenure**  
- Senior Product Designer, 2020–2023  
- Lead Product Designer for Patient Experience + Growth  
- UX Research · Product Strategy · Prototyping · Data Visualization · Service Design  
- Drove alignment via Design Sprints with cross-functional leaders

**Impact at a glance**  
- Launched PicnicHealth’s first enterprise web app (SCOPE)  
- Improved data quality via more efficient QC workflows  
- Reduced analytics backlog by 80% within 4 weeks  
- Decreased “Time to Insight” for internal + external users  
- Enabled new enterprise product lines and revenue streams  

---

## Discovery  
Stu began with a **task analysis** of the data science team to identify tasks that could be productized or automated.  
Through this research, the team discovered that roughly **75% of research requests** could be turned into self-service operations, potentially cutting the analytics workload by half.

Two primary capabilities were prioritized:
1. **Reports** — quick-glance dashboards summarizing key metrics (demographics, diagnoses, medications, survey completion).  
2. **Querying** — a cohort builder enabling users to define patient subsets by criteria such as demographics, onboarding date, or health variables.

Together, these capabilities would allow users to **characterize and segment patient cohorts**, forming the backbone of SCOPE’s functionality.

---

## Prototyping & Validation  
Stu and the team built low-fidelity, functional prototypes to test the value of self-service tooling in live workflows:

- **Cohort Builder v1** — basic querying via progressive filters; real-time counts from the data warehouse; implemented in R Studio.  
- **Relevancy Dashboard** — visual summary statistics and condition metrics; implemented via spreadsheets.

Even in these crude forms, the prototypes demonstrated major efficiency gains.  
Testing with power users surfaced three crucial insights:

### 1. Confidence is the biggest hurdle to adoption  
Enterprise users needed to **trust** the tool and their own ability to use it correctly — especially when results informed FDA submissions or multimillion-dollar deals.

### 2. Balancing accessibility and expert utility  
The most powerful features could easily intimidate less-technical users. SCOPE needed to serve both without reintroducing bottlenecks.

### 3. Synergy between Reports + Querying  
The combination of reports and querying was exponentially more powerful than either alone — the final product would need to **fully integrate** them.

---

## Product Design  

### Architecture & Framework  
With validated prototypes in hand, the team productized SCOPE, leveraging an internal platform called **FLEX** for faster development.  
The solution integrated **Reports**, **Querying**, and several new enterprise capabilities: **onboarding, project navigation, file sharing, and documentation**.

---

### Reports  
SCOPE’s Reports dashboard offered high-impact visualizations and summaries:
- **Relevancy Report** — demographics, medication use, lab results, key metrics.  
- **Surveys Report** — PRO completion and performance trends.

Each report was designed as a **modular framework** for extensibility — new report types and filters could be added as use cases evolved.

---

### Querying  
The **Querying** feature enabled users to define cohorts dynamically via a filter drawer and card-based UX.  
This card approach balanced simplicity and capability: intuitive for non-technical users but extensible enough for advanced logic.

Alternative prototypes explored more complex query builders (AND/OR logic, nested queries), but were reserved for later versions.

---

### Onboarding  
As the company’s first enterprise-facing app, SCOPE required robust onboarding and authentication:
- Secure login for both new and long-term customers  
- Role-based access to projects and data  
- Clear account-level hierarchy to reduce support friction

---

### Cohort Navigation  
Enterprise customers often managed multiple studies.  
Stu designed a **card-based navigation** system that displayed key project metadata (last updated date, patient count, collaborators).  
This replaced complex file explorers with a lightweight, visual approach.

---

### File Sharing  
Although peripheral to core analytics, integrated file sharing consolidated all project artifacts (reports, exports, and deliverables) into a single location — easing the transition for customers accustomed to analyst handoffs.

---

### Documentation  
The SCOPE rollout exposed major gaps in customer documentation.  
Stu led the redesign of the enterprise documentation hub — modular, discoverable, and aligned with the new platform capabilities.

---

## Launch & Impact  
SCOPE launched internally in early 2022 and to enterprise customers by Q3 2022.

**Team Productivity**  
- 60% reduction in average turnaround time for research tasks  
- 80% decrease in analytics backlog within 4 weeks  

**Customer Success**  
- +15% increase in Customer Satisfaction Score (CSAT)  
- 40% reduction in inbound support tickets  

**Data Production**  
- 70% more QC errors caught pre-delivery  
- 30% faster quality-control processing  

Today, SCOPE remains a cornerstone of PicnicHealth’s data-delivery stack — used across internal teams and by leading life-sciences clients for real-world evidence studies.

---

## Lessons & Takeaways  
- **Adoption = confidence × clarity.** Tools that empower expert work must instill trust as much as they deliver power.  
- **Balance accessibility and depth.** Card-based UX let less-technical users achieve 80% of expert utility without fear.  
- **Extensibility from day one.** The modular Reports + Querying framework enabled rapid expansion into new analytics use cases.  
- **Good design accelerates science.** SCOPE didn’t just look better — it meaningfully shortened the distance from data to insight.
