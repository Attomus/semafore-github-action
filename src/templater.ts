export interface WorkflowContext {
  readonly runId?: string;
  readonly ref?: string;
  readonly sha?: string;
  readonly actor?: string;
  readonly workflow?: string;
  readonly repository?: string;
}

export function renderTemplate(template: string, context: WorkflowContext): string {
  return template.replace(/\{\{\s*(run_id|ref|sha|actor|workflow|repository)\s*\}\}/g, (_match, key: string) => {
    const value = contextValue(context, key);
    return value ?? '';
  });
}

export function githubContextFromEnv(env: NodeJS.ProcessEnv = process.env): WorkflowContext {
  const context: {
    runId?: string;
    ref?: string;
    sha?: string;
    actor?: string;
    workflow?: string;
    repository?: string;
  } = {};
  if (env.GITHUB_RUN_ID) context.runId = env.GITHUB_RUN_ID;
  if (env.GITHUB_REF) context.ref = env.GITHUB_REF;
  if (env.GITHUB_SHA) context.sha = env.GITHUB_SHA;
  if (env.GITHUB_ACTOR) context.actor = env.GITHUB_ACTOR;
  if (env.GITHUB_WORKFLOW) context.workflow = env.GITHUB_WORKFLOW;
  if (env.GITHUB_REPOSITORY) context.repository = env.GITHUB_REPOSITORY;
  return context;
}

function contextValue(context: WorkflowContext, key: string): string | undefined {
  switch (key) {
    case 'run_id':
      return context.runId;
    case 'ref':
      return context.ref;
    case 'sha':
      return context.sha;
    case 'actor':
      return context.actor;
    case 'workflow':
      return context.workflow;
    case 'repository':
      return context.repository;
    default:
      return undefined;
  }
}
