const { createPlugin } = require("@aicupa/api");
const path = require("path");
const os = require("os");
const fs = require("fs");

const configPath = path.join(
  os.homedir(),
  ".todoListNative",
  "plugin-balance.json",
);

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (_) {
    return {};
  }
}

function saveConfig(data) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(data));
  } catch (_) {}
}

module.exports = createPlugin((api) => {
  const saved = loadConfig();
  let tempNodeId = saved.tempId || null;
  let currentNodeId = saved.currentId || null;

  function collectDoneTime(node) {
    let total = 0;

    const today = new Date();
    today.setHours(8, 0, 0, 0);
    const startOfDayTimestamp = today.getTime();

    if (!node) return total;
    const stack = [node];
    while (stack.length) {
      const n = stack.pop();
      if (
        n.todo?.done &&
        n.todo?.start &&
        n.todo?.end &&
        n.todo.end > n.todo.start
      ) {
        if (n.todo.keep) continue;

        let end = n.todo.end;
        let start = n.todo.start;

        if (start < startOfDayTimestamp) {
          start = startOfDayTimestamp;
        }
        total += n.todo.end - n.todo.start;
      }
      if (Array.isArray(n.children)) {
        stack.push(...n.children);
      }
    }
    return total;
  }

  function collectFocusedItems(tree) {
    const items = [];
    if (!Array.isArray(tree)) return items;
    const stack = [...tree];
    while (stack.length) {
      const n = stack.pop();
      if (n.todo?.focus && n.todo?.content) {
        items.push(n.todo.content);
      }
      if (Array.isArray(n.children)) {
        stack.push(...n.children);
      }
    }
    return items;
  }

  function findNodeById(tree, id) {
    const stack = [...tree];
    while (stack.length) {
      const n = stack.pop();
      if (String(n.key) === String(id)) return n;
      if (Array.isArray(n.children)) {
        stack.push(...n.children);
      }
    }
    return null;
  }

  return {
    copyNodeId({ node }) {
      if (node?.key != null) {
        api.clipboard.writeText(String(node.key));
        return { ok: true };
      }
      return { ok: false, error: "No node key" };
    },

    setConfig({ tempId, currentId }) {
      tempNodeId = tempId;
      currentNodeId = currentId;
      saveConfig({ tempId, currentId });
      return { ok: true };
    },

    getConfig() {
      return {
        ok: true,
        result: { tempId: tempNodeId, currentId: currentNodeId },
      };
    },

    getFocusedItems({ tree }) {
      return { ok: true, result: collectFocusedItems(tree) };
    },

    calculate({ tree }) {
      if (!Array.isArray(tree) || !tempNodeId || !currentNodeId) {
        return {
          ok: true,
          result: { percent: 0, tempTime: 0, currentTime: 0 },
        };
      }

      const tempNode = findNodeById(tree, tempNodeId);
      const currentNode = findNodeById(tree, currentNodeId);
      const tempTime = collectDoneTime(tempNode);
      const currentTime = collectDoneTime(currentNode);
      const percent = Math.round((tempTime / (currentTime + tempTime)) * 100);

      return {
        ok: true,
        result: { percent, tempTime, currentTime },
      };
    },
  };
});
