const { program } = require("commander");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

program
  .requiredOption("-H, --host <host>")
  .requiredOption("-p, --port <port>")
  .requiredOption("-c, --cache <path>");

program.parse();
const options = program.opts();
const app = express();
const port = options.port;

app.use(express.static(path.join(__dirname, "public")));

if (!fs.existsSync(options.cache)) {
  fs.mkdirSync(options.cache, { recursive: true });
  console.log("Директорію створено");
}

const dbPath = path.join(options.cache, "data.json");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, options.cache);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage: storage });

function readData() {
  if (!fs.existsSync(dbPath)) return [];
  const data = fs.readFileSync(dbPath);
  return JSON.parse(data);
}

function writeData(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post("/register", upload.single("photo"), (req, res) => {
  const { inventory_name, description } = req.body;

  if (!inventory_name) {
    return res
      .status(400)
      .json({ message: "Поле inventory_name є обов'язковим" });
  }

  const inventories = readData();

  const newInventory = {
    id: uuidv4(),
    inventory_name: inventory_name,
    description: description || "",
    photo: req.file ? req.file.filename : null,
  };

  inventories.push(newInventory);
  writeData(inventories);

  res.status(201).json(newInventory);
});

app.get("/inventory", (req, res) => {
  const allItems = readData();
  const itemsWithLinks = allItems.map((item) => {
    return {
      id: item.id,
      inventory_name: item.inventory_name,
      description: item.description,
      photo_url: item.photo
        ? `${req.protocol}://${req.get("host")}/inventory/${item.id}/photo`
        : null,
    };
  });
  res.status(200).json(itemsWithLinks);
});

app.get("/inventory/:id", (req, res) => {
  const allItems = readData();
  id = req.params.id;
  const findItem = allItems.find((item) => {
    return item.id === id;
  });
  if (findItem) {
    const itemWithLink = {
      ...findItem,
      photo_url: findItem.photo
        ? `${req.protocol}://${req.get("host")}/inventory/${findItem.id}/photo`
        : null,
    };
    res.status(200).json(itemWithLink);
  } else {
    res.status(404).json({ message: "Річ з таким ID не знайдено" });
  }
});

app.put("/inventory/:id", (req, res) => {
  const allItems = readData();
  const id = req.params.id;
  const { inventory_name, description } = req.body;

  const findIndex = allItems.findIndex((item) => {
    return item.id === id;
  });

  if (findIndex !== -1) {
    if (inventory_name) {
      allItems[findIndex].inventory_name = inventory_name;
    }
    if (description) {
      allItems[findIndex].description = description;
    }
    writeData(allItems);
    res.status(200).json(allItems[findIndex]);
  } else {
    res.status(404).json({ message: "Річ з таким ID не знайдено" });
  }
});

app.get("/inventory/:id/photo", (req, res) => {
  const allItems = readData();
  const id = req.params.id;
  const findItem = allItems.find((item) => {
    return item.id === id;
  });
  if (findItem) {
    if (findItem.photo) {
      const photoPath = path.join(options.cache, findItem.photo);
      if (fs.existsSync(photoPath)) {
        res.sendFile(photoPath);
      } else {
        res.status(404).json({ message: "Немає фото" });
      }
    } else {
      res.status(404).json({ message: "Не було завантажено фото" });
    }
  } else {
    res.status(404).json({ message: "Річ з таким ID не знайдено" });
  }
});

app.put("/inventory/:id/photo", upload.single("photo"), (req, res) => {
  const allItems = readData();
  const id = req.params.id;
  if (!req.file) {
    return res.status(400).json({ message: "Файл фото не було завантажено" });
  }
  const findIndex = allItems.findIndex((item) => {
    return item.id === id;
  });
  if (findIndex !== -1) {
    const oldPhotoName = allItems[findIndex].photo;
    if (oldPhotoName) {
      const oldPhotoPath = path.join(options.cache, oldPhotoName);
      fs.unlinkSync(oldPhotoPath);
      console.log("Старе фото було видалено:", oldPhotoPath);
    }
    allItems[findIndex].photo = req.file.filename;
    writeData(allItems);
    res.status(200).json(allItems[findIndex]);
  } else {
    res.status(404).json({ message: "Річ з таким ID не знайдено" });
  }
});

app.delete("/inventory/:id", (req, res) => {
  const allItems = readData();
  const id = req.params.id;
  const findIndex = allItems.findIndex((item) => {
    return item.id === id;
  });

  if (findIndex !== -1) {
    const itemToDelete = allItems[findIndex];
    if (itemToDelete.photo) {
      const pathToPhoto = path.join(options.cache, itemToDelete.photo);
      fs.unlinkSync(pathToPhoto);
      console.log("Пов'язане фото видалено:", photoPath);
    }
    allItems.splice(findIndex, 1);
    writeData(allItems);
    res.status(200).json({ message: "Річ успішно видалено" });
  } else {
    res.status(404).json({ message: "Річ з таким ID не знайдено" });
  }
});

app.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}`);
});
