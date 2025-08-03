async function analyzeEngagement() {
    const resultsEl = document.getElementById('results');
    const loadingEl = document.getElementById('loading');
    const suggestionEl = document.getElementById('suggestion');
    const errorEl = document.getElementById('error');
    const reasoningEl = document.getElementById('reasoning');
    const amountEl = document.getElementById('amount');

    resultsEl.classList.remove('hidden');
    loadingEl.classList.remove('hidden');
    suggestionEl.classList.add('hidden');
    errorEl.classList.add('hidden');

    try {
        const [project, user] = await Promise.all([
            websim.getCurrentProject(),
            websim.getUser()
        ]);

        if (!project || !user) {
            throw new Error("Could not get project or user info. Are you logged in?");
        }

        const projectId = project.id;
        const userId = user.id;

        // Fetch engagement data
        const likeResponse = await fetch(`/api/v1/users/${user.username}/project/${projectId}/like`);
        const likeData = await likeResponse.json();
        const hasLiked = !!likeData.like;

        const commentsResponse = await fetch(`/api/v1/projects/${projectId}/comments`);
        const commentsData = await commentsResponse.json();
        const userComments = commentsData.comments.data
            .filter(item => item.comment.author.id === userId)
            .map(item => ({ content: item.comment.raw_content, created_at: item.comment.created_at }));

        const descendantsResponse = await fetch(`/api/v1/projects/${projectId}/descendants`);
        const descendantsData = await descendantsResponse.json();
        const hasRemixed = descendantsData.projects.data.some(p => p.project.created_by.id === userId);

        const engagementData = {
            hasLiked,
            commentCount: userComments.length,
            comments: userComments.map(c => c.content),
            hasRemixed,
            projectTitle: project.title,
            projectDescription: project.description,
        };
        
        const completion = await websim.chat.completions.create({
            messages: [{
                role: "system",
                content: `You are an AI assistant that helps users decide how much to tip on a websim project. You will get a user's engagement data. Analyze this engagement to suggest a tip amount in credits. A small tip is 10 credits, medium is 50, and large is 100+. Base your suggestion on the quality and quantity of engagement. A thoughtful comment is more valuable than just "nice". A remix is a strong signal of engagement. A like is a basic signal. No engagement means no tip. Respond ONLY with a JSON object with this schema: {"reasoning": "A short explanation for your suggestion.", "amount": <integer>}`
            }, {
                role: "user",
                content: `Engagement data: ${JSON.stringify(engagementData, null, 2)}`
            }],
            json: true,
        });

        const result = JSON.parse(completion.content);

        reasoningEl.textContent = result.reasoning;
        amountEl.textContent = result.amount;

        loadingEl.classList.add('hidden');
        suggestionEl.classList.remove('hidden');

    } catch (err) {
        console.error("Analysis failed:", err);
        loadingEl.classList.add('hidden');
        errorEl.classList.remove('hidden');
        errorEl.querySelector('p').textContent = err.message || "An unexpected error occurred.";
    }
}

document.getElementById('analyzeBtn').addEventListener('click', analyzeEngagement);