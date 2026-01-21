
// Get the date of when the repository was last updated and write it into the corresponding footer span
const desiredRepo = "decision-trees-simulator-teachers";
const dateTagClass = ".date";

document.addEventListener("DOMContentLoaded", async () => {
    const el = document.getElementById("visit-count");
    if (!el) return;
    const key = `gadea-lucas.github.io-${desiredRepo}-visitas`;
    const sessionKey = "visit_counted_this_session";

    try {
        const endpoint = sessionStorage.getItem(sessionKey)
        ? `https://countapi.mileshilliard.com/api/v1/get/${encodeURIComponent(key)}`
        : `https://countapi.mileshilliard.com/api/v1/hit/${encodeURIComponent(key)}`;
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        el.textContent = data.value;
        sessionStorage.setItem(sessionKey, "1");
    } catch (err) {
        console.error("Visit counter error: ", err);
        el.textContent = "—";
    }
});

var xhttp = new XMLHttpRequest();
xhttp.onreadystatechange = function () {
    if (this.readyState == 4 && this.status == 200) {
        let repos = JSON.parse(this.responseText);

        repos.forEach((repo) => {
            if (repo.name == desiredRepo) {
                let lastUpdated = new Date(repo.updated_at);
                let day = lastUpdated.getUTCDate();
                let month = lastUpdated.getUTCMonth() + 1;
                let year = lastUpdated.getUTCFullYear();
                $(dateTagClass).text(`Last updated: ${day}-${month}-${year}`);
            }
        });
    }
};
xhttp.open("GET", "https://api.github.com/users/gadea-lucas/repos", true);
xhttp.send();