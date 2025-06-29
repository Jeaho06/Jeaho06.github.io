# 🤖 Cheating AI Omok (반칙 AI 오목)

[🇰🇷 Korean](./README.ko.md) | 🇬🇧 English

An online Omok (Gomoku/Five-in-a-Row) game with a new concept where the AI opponent uses various cheats to win. This project is built with pure HTML, CSS, and JavaScript, offering the fun challenge of competing against an intelligent AI that predicts user moves and responds with unfair tactics.

<br>

**[➡️ Play the Game!](https://omok.ai.kr)**

<br>

<p align="center">
  <a href="https://omok.ai.kr">
    <img src="https://i.imgur.com/17cffd.png" width="700" alt="Omok Game Screenshot">
  </a>
</p>

---

## ✨ Features

* **Intelligent AI**: Utilizes a score-based evaluation function to find the optimal move by calculating the value of every possible position on the board.
* **Various Cheat System**: To win, the AI employs several cunning cheats:
    * **Destiny's Denial (1 time)**: Instantly nullifies the user's game-winning move, once per game.
    * **Place Bomb**: Places a bomb that detonates on the AI's next turn, clearing a 3x3 area.
    * **Double Move**: Places two stones in a single turn to quickly gain an advantage.
    * **Swap Stone**: Swaps the position of its own stone with the user's last move to turn the tables.
* **Real-time Cheat Control**: Users can enable or disable each AI cheat in real-time via UI toggles.
* **Multi-language Support**: Supports Korean, English, and Japanese, and can be easily expanded by adding new language files.
* **Detailed Logs**: Provides separate, clear logs for game moves (with turn counters) and the AI's reasoning behind each move.


## 🚀 Getting Started

This project requires a web server environment to fetch language files (`/lang/*.json`).

1.  Clone the repository to your local machine:
    ```bash
    git clone [https://github.com/Jeaho06/Jeaho06.github.io.git](https://github.com/Jeaho06/Jeaho06.github.io.git)
    ```
2.  Open the project folder in VS Code.
3.  Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension.
4.  Right-click on `index.html` and select `Open with Live Server` to run the game locally.

---

## 📜 License

This project is licensed under the MIT License. See the `LICENSE` file for details.
