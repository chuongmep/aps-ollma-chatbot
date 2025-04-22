import { initViewer, loadModel } from "./viewer.js";
import { initBrowser } from "./browser.js";
import { initChatbot } from "./chatbot.js";

const login = document.getElementById("login");
try {
    const resp = await fetch("/auth/profile");
    if (resp.ok) {
        const user = await resp.json();
        login.innerText = `Logout (${user.name})`;
        login.onclick = () => window.location.replace("/auth/logout");
        const viewer = await initViewer(document.getElementById("preview"));
        initBrowser(document.getElementById("tree"), (id) => {
            const urn = window.btoa(id).replace(/=/g, "").replace("/", "_");
            loadModel(viewer, urn);
            initChatbot(document.getElementById("chatbot"), urn);
            document.getElementById("chatbot").addEventListener("click", function ({ target }) {
                if (target.dataset.dbids) {
                    const dbids = target.dataset.dbids.split(",").map(e => parseInt(e));
                    viewer.isolate(dbids);
                    viewer.fitToView(dbids);
                }
            });
        });
    } else {
        login.innerText = "Login";
        login.onclick = () => window.location.replace("/auth/login");
    }
    login.style.visibility = "visible";
} catch (err) {
    alert("Could not initialize the application. See console for more details.");
    console.error(err);
}
