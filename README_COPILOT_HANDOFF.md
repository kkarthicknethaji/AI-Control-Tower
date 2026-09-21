# AI Control Tower Copilot Handoff Pack

Use this pack with VS Code + GitHub Copilot Agent mode to implement the redesigned AI Control Tower as a React + Tailwind + shadcn/ui module inside the existing Product Studio repository.

## Place these files

Copy the files into the repo using the same relative paths:

```text
.github/copilot-instructions.md
.github/instructions/ai-control-tower.instructions.md
.github/agents/ai-control-tower-plan-review.agent.md
docs/ai-control-tower/coding-standards.md
docs/ai-control-tower/design-instructions.md
docs/ai-control-tower/implementation-guardrails.md
assets/Product_Studio_Icon.ico
```

Also include these already-created handoff artifacts in the workspace:

```text
ai_control_tower_react_tailwind_implementation_spec.md
ai_control_tower_phase2_prototype_v7.html
Product_Studio_Icon.ico
```

## How to use with Copilot

1. Open the Product Studio repo in VS Code.
2. Add the handoff artifacts above.
3. Start Copilot Chat in Agent mode.
4. Paste the main handover prompt provided in the conversation.
5. Tell Copilot: "Read `.github/copilot-instructions.md`, `docs/ai-control-tower/coding-standards.md`, `docs/ai-control-tower/design-instructions.md`, the implementation spec, and the v7 prototype before writing code. First produce a file-level implementation plan."

## Important intent

The prototype is the visual and interaction target. The implementation spec is the engineering contract. The existing Product Studio repo is the source of truth for authentication, Supabase, RPC names, app context, and integration behavior.

Do not let Copilot treat the prototype's sample numbers as production data. Production data must come from the existing Supabase RPCs and helpers.
