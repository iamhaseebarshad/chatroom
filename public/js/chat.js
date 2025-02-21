const socket = io();

// Elements
const $messageForm = document.querySelector("#message-form");
const $messageFormInput = $messageForm.querySelector("input");
const $messageFormButton = $messageForm.querySelector("button");
const $sendLocationButton = document.querySelector("#send-location");
const $messages = document.querySelector("#messages");

// Templates
const messageTemplate = document.querySelector("#message-template").innerHTML;
const locationTemplate = document.querySelector("#locmessage-template").innerHTML;
const sidebarTemplate = document.querySelector("#sidebar-template").innerHTML;

// Options
const { username, room } = Qs.parse(location.search, { ignoreQueryPrefix: true });

// Auto-scroll function (Improved version)
const autoScroll = () => {
    const $newMessage = $messages.lastElementChild;

    if ($newMessage) {
        const newMessageStyles = getComputedStyle($newMessage);
        const newMessageMargin = parseInt(newMessageStyles.marginBottom);
        const newMessageHeight = $newMessage.offsetHeight + newMessageMargin;

        const visibleHeight = $messages.offsetHeight;
        const containerHeight = $messages.scrollHeight;
        const scrollOffset = $messages.scrollTop + visibleHeight;

        // Scroll to bottom if user is near the bottom
        if (containerHeight - newMessageHeight <= scrollOffset + 100) {
            $messages.scrollTo({
                top: containerHeight,
                behavior: 'smooth' // Smooth scrolling effect
            });
        } else if (scrollOffset >= containerHeight - visibleHeight - 10) {
            // If already at the bottom, keep auto-scrolling
            $messages.scrollTop = containerHeight;
        }
    }
};

// Local Storage Functions
const saveMessagesToCache = (messages) => {
    localStorage.setItem(`chatMessages-${room}`, JSON.stringify(messages));
};

const loadMessagesFromCache = () => {
    const cachedMessages = JSON.parse(localStorage.getItem(`chatMessages-${room}`)) || [];
    cachedMessages.forEach((message) => displayMessage(message, message.username === username));
    autoScroll();  // Ensure the scroll is set correctly after loading cached messages
};

// Display Message Function (Handles admin messages and "You")
const displayMessage = (message, isCurrentUser) => {
    const nameToDisplay = isCurrentUser ? "You" : message.username;
    const messageClass = message.username === "Admin" ? "message--admin" : "";

    const html = Mustache.render(messageTemplate, {
        username: nameToDisplay,
        message: message.text,
        createdAt: moment(message.createdAt).format("h:mm a"),
        messageClass: messageClass,
    });

    $messages.insertAdjacentHTML("beforeend", html);

    // Call autoScroll for smooth scrolling after adding a new message
    autoScroll();
};

// Socket.IO Event Handlers
socket.on("connect", () => {
    console.log("Connected to server!"); // Helpful debug message

    socket.emit("join", { username, room }, (error) => {
        if (error) {
            alert(error);
            location.href = "/";
        } else {
            loadMessagesFromCache();
        }
    });
});

socket.on("message", (message) => {
    const isCurrentUser = message.username === username;
    displayMessage(message, isCurrentUser);
    let messages = JSON.parse(localStorage.getItem(`chatMessages-${room}`)) || [];
    messages.push(message);
    saveMessagesToCache(messages);
});

socket.on("locationMessage", (locationData) => {
    const isCurrentUser = locationData.username === username;
    displayMessage(locationData, isCurrentUser);
});

socket.on("roomData", ({ room, users }) => {
    const html = Mustache.render(sidebarTemplate, { room, users });
    document.querySelector("#sidebar").innerHTML = html;
    autoScroll(); // Ensure sidebar changes do not affect scroll
});

socket.on("disconnect", () => {
    console.log("Disconnected from server");
});

// Event Listeners
$messageForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const message = $messageFormInput.value.trim();
    if (!message) return;

    $messageFormButton.setAttribute("disabled", "disabled");

    socket.emit("sendMessage", message, (error) => {
        $messageFormButton.removeAttribute("disabled");
        $messageFormInput.value = "";
        $messageFormInput.focus();

        if (error) {
            return console.error("Error:", error);
        }
    });
});

$sendLocationButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
        return alert("Geolocation is not supported by your browser.");
    }

    $sendLocationButton.setAttribute("disabled", "disabled");

    navigator.geolocation.getCurrentPosition(
        (position) => {
            socket.emit("sendLocation", {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
            }, () => {
                $sendLocationButton.removeAttribute("disabled");
            });
        },
        (error) => {
            alert("Failed to get location. Please allow location access.");
            $sendLocationButton.removeAttribute("disabled");
        }
    );
});
