import { Application, Context } from 'probot' // eslint-disable-line no-unused-vars
import Webhooks from '@octokit/webhooks';

export = (app: Application) => {

  var translations = "translations"
  app.on('issue_comment.created', async (context) => {
    //const issueComment = context.issue({ body: 'Thanks for opening this issue!' })
    app.log("Comment created")
    var owner = context.repo({}).owner

    if(context.payload.comment.body == "summary"){
      var result = await context.github.repos.listCommits(context.repo({per_page:30}))
      console.log(result.data)
      var commitSummary = ""
      result.data.forEach(commit => {
        commitSummary += "\n\n"+commit.commit.message.split("\n")[0]
        if(commit.author.login != owner) commitSummary += " - By "+commit.author.login
        console.log(commitSummary)
      })
      context.github.issues.createComment(context.issue({ body: commitSummary }))
      return
    }

    if (context.payload.comment.body != "merge translations") return
    if (context.payload.comment.user.login != owner) {
      await context.github.issues.createComment(context.issue({ body: 'Do not meddle in the affairs of wizards' }))
      return
    }

    await createTranslationBranchIfNeeded(context)

    await createTranslationPrIfNeeded(context, owner, translations);

    var ourPr = await context.github.pulls.get(context.repo({ pull_number: context.payload.issue.number }))
    if (ourPr.data.base.label != context.repo({}).owner + ":" + translations) {
      await context.github.pulls.update(context.repo({ pull_number: context.payload.issue.number, base: translations }))
    }
    // else await context.github.issues.createComment(context.issue({ body: 'Already in '+translations }))
    
    if (ourPr.data.state == "open" && ourPr.data.mergeable) {
      await context.github.pulls.merge(context.repo({ pull_number: context.payload.issue.number, merge_method: "squash" }))
    }
    else await context.github.issues.createComment(context.issue({ body: 'Not mergable' }))
  })

  async function branchExists(context: Context<Webhooks.WebhookPayloadIssueComment>, branchName: String) {
    try {
      await context.github.git.getRef(context.repo({ ref: 'heads/' + branchName }))
      return true
    } catch (err) {
      return false
    }
  }

  async function getDefaultBranch(context: Context<Webhooks.WebhookPayloadIssueComment>) {
    var repo = await context.github.repos.get(context.repo())
    return repo.data.default_branch
  }

  async function createTranslationBranchIfNeeded(context: Context<Webhooks.WebhookPayloadIssueComment>) {
    if (await branchExists(context, translations)) return
    
    var defaultBranch = await getDefaultBranch(context)
    var currentHead = await context.github.git.getRef(context.repo({ ref: 'heads/' + defaultBranch }))
    var currentSha = currentHead.data.object.sha
    app.log("Current sha: " + currentSha)
    await context.github.git.createRef(context.repo({ ref: `refs/heads/translations`, sha: currentSha }))
    await context.github.issues.createComment(context.issue({ body: 'Translations branch created' }))
  }


  async function createTranslationPrIfNeeded(context: Context<Webhooks.WebhookPayloadIssueComment>,
    owner: string, translations: string) {
    var translationPulls = await context.github.pulls.list(context.repo({ state: "open", head: owner + ":" + translations }));
    if (translationPulls.data.length == 0) {
      var defaultBranch = await getDefaultBranch(context);
      await context.github.pulls.create(context.repo({ title: "Translations update", head: translations, base: defaultBranch }));
      await context.github.issues.createComment(context.issue({ body: 'Translations PR created' }));
    }
  }

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
}


