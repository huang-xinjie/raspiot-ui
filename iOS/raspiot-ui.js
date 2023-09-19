// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: sitemap;
roomInProcess = false
CONF = readConfig()
main()

function main() {
    if (config.runsInWidget) {
        kwargs = getWidgetParameter()
        if (kwargs.attr) {
            showDeviceInWidget(kwargs)
        } else {
            showRoomInWidget(kwargs)
        }
    } else if (args.queryParameters.runType === 'api') {
        runInApi(args.queryParameters)
    } else if (config.runsInApp) {
        runInApp(args.queryParameters)
    }
}

function readConfig() {
    fm = FileManager.local()
    configFile = fm.joinPath(
        fm.documentsDirectory(), "raspiot-ui.json")
    if (!fm.fileExists(configFile)) {
        saveConfig()
    }

    return JSON.parse(fm.readString(configFile))
}

function saveConfig() {
    fm = FileManager.local()
    configFile = fm.joinPath(
        fm.documentsDirectory(), "raspiot-ui.json")
    defaultConfig = {
        raspiotEndpoint: "http://",
        widgetPadding: 5,
        widgetShownAttr: []
    }

    if (typeof CONF == "undefined") {
        CONF = defaultConfig
    }

    fm.writeString(configFile,
        JSON.stringify(CONF))
}

async function runInApi(kwargs) {
    filters = {
        room: kwargs.room,
        name: kwargs.device,
        detail: "true"
    }
    devices = await getDeviceList(filters)
    if (!devices) {
        notification("Invalid device", `device ${cmd.device} not found`)
        Script.complete()
    }

    device = devices[0]
    if (kwargs.action === "set") {
        await setAttr(null, kwargs.room, device, kwargs.attr, kwargs.value)
    } else {
        for (i in device.attrs) {
            if (device.attrs[i].name === kwargs.attr) {
                return device.attrs[i].value
            }
        }
    }
}

async function runInApp(kwargs) {
    log("kwargs: " + JSON.stringify(kwargs))
    houseTable = new UITable()
    raspiot(houseTable)
    houseTable.showSeparators = true
    houseTable.present(fullscreen=true)

    if (kwargs.action === "set") {
        await runInApi(kwargs)
    }

    if (kwargs.room) {
        onShow = new Set([kwargs.device || ""])
        showRoom(kwargs.room, onShow)
    } else if (kwargs.ui === "setting") {
        showUiSetting()
    }
}

function getWidgetParameter() {
    parameter = {}
    paras = (args.widgetParameter || "").split("&")
    for(var i = 0; i < paras.length; i++) {
        kv = paras[i].split("=")
        parameter[kv[0]] = unescape(kv[1]);
    }
    return parameter
}

async function showDeviceInWidget(kwargs) {
    // action=get&room=bedroom&device=dht11温湿度&attr=temp
    log("kwargs: " + JSON.stringify(kwargs))
    const lw = new ListWidget()
    value = await runInApi(kwargs)

    lw.backgroundColor = new Color("#ac3929")
    setListWidgetText(lw, kwargs.room, 26)
    setListWidgetText(lw, kwargs.device, 22)
    setListWidgetText(lw, kwargs.attr, 18)
    setListWidgetText(lw, String(value), 18)
    Script.setWidget(lw)
    Script.complete()
}

function setListWidgetText(lw, text, size) {
    size = size || 22
    const t = lw.addText(text)
    t.font = Font.boldRoundedSystemFont(size)
    t.minimumScaleFactor = 0.2
    t.textColor = Color.white()
    t.lineLimit = 2
    t.leftAlignText()
    lw.addSpacer(6)
    return t
}

async function showRoomInWidget(kwargs) {
    lw = new ListWidget()
    lw.backgroundColor = Device.isUsingDarkAppearance() ? new Color("#302E2A") : new Color("#CDC6C3", 0.3)
    lw.refreshAfterDate = new Date(Date.now() + (5 * 1000))
    lw.setPadding(CONF.widgetPadding, 0, 0, 0)

    rooms = await getRoomList()
    if (rooms && CONF.widgetShownAttr.length) {
        limit = config.widgetFamily === "small" ? 1 : kwargs.limit || 2
        limit = Math.min(Math.max(limit, 0), 2)
        marker = Math.min(Math.max(
            kwargs.marker || 0, 0), rooms.length)
        await addRoomGroupStack(lw, rooms.slice(marker, marker + limit))
        if (config.runsInWidget && config.runsInApp) {
            lw.addSpacer(CONF.widgetPadding)
            await addRoomGroupStack(
                lw, rooms.slice(2, 4))
        }
    } else {
        if (rooms === null) {
            msg = "Fail to request, pls check network or raspiot-server."
            rooms.has("")  // keep widget display
        } else if (CONF.raspiotEndpoint === "http://") {
            msg = "Pls set raspiot-server's ip in settings at first."
        } else {
            msg = "Select attrs to show in settings."
        }

        setListWidgetText(lw, msg, 22).centerAlignText()
        lw.backgroundColor = new Color("#ac3929")
        lw.url = encodeURI(`scriptable:///run?scriptName=${Script.name()}&ui=setting`)
    }

    Script.setWidget(lw)
    Script.complete()
    lw.presentMedium()
}

async function addRoomGroupStack(w, rooms) {
    stackSize = 2
    rg = w.addStack()
    rn = w.addStack()
    while (rooms.length <= stackSize) {
        rooms.push({name: ""})
    }

    roomColor = [
        new Color("#50CCB0"),
        new Color("#52C8DA"),
        new Color("#32C13A")]
    random = Math.floor(Math.random() * 10)
    rooms.forEach(room => {
        room.color = roomColor[(random++) % roomColor.length]
    })

    await addRoomStack(rg, rn, rooms[0])
    rg.addSpacer(CONF.widgetPadding * 4)
    rn.addSpacer(CONF.widgetPadding * 12)
    await addRoomStack(rg, rn, rooms[1])
}

async function addRoomStack(rg, rn, room) {
    rg.addSpacer(CONF.widgetPadding)
    roomStack = rg.addStack()
    roomStack.layoutVertically()
    roomStack.cornerRadius = 15
    roomStack.addSpacer(CONF.widgetPadding)

    shownAttrs = await getShownAttrs(room)
    attr1st = roomStack.addStack()
    attr1st.layoutHorizontally()
    attr1st.addSpacer(CONF.widgetPadding)
    attr1st.addImage(drawDeviceAttr(
        shownAttrs[0])).url = shownAttrs[0].url
    attr1st.addSpacer(CONF.widgetPadding)
    attr1st.addImage(drawDeviceAttr(
        shownAttrs[1])).url = shownAttrs[1].url
    attr1st.addSpacer(CONF.widgetPadding)
    roomStack.addSpacer(CONF.widgetPadding)

    attr2nd = roomStack.addStack()
    attr2nd.layoutHorizontally()
    attr2nd.addSpacer(CONF.widgetPadding)
    attr2nd.addImage(drawDeviceAttr(
        shownAttrs[2])).url = shownAttrs[2].url
    attr2nd.addSpacer(CONF.widgetPadding)
    attr2nd.addImage(drawDeviceAttr(
        shownAttrs[3])).url = shownAttrs[3].url
    attr2nd.addSpacer(CONF.widgetPadding)
    roomStack.addSpacer(CONF.widgetPadding)

    rg.addSpacer(CONF.widgetPadding)
    if (shownAttrs[0].deviceName) {
        addRoomName(rn, room.name)
        roomStack.backgroundColor = new Color("#ffffff", 0.5)
        roomStack.url = encodeURI(`scriptable:///run?scriptName=${Script.name()}&action=get&room=${room.name}`)
    }
}

async function getShownAttrs(room) {
    shownAttrs = []
    filters = {detail: "true", room: room.name}
    widgetShownAttr = new Set(CONF.widgetShownAttr)
    devices = await getDeviceList(filters)
    for (d in devices) {
        device = devices[d]
        for (a in device.attrs) {
            attr = device.attrs[a]
            attrKey = `${device.uuid}:${attr.name}`
            if (widgetShownAttr.has(attrKey)) {
                action = (attr.type === "button" || attr.type === "switch") ? "set" : "get"
                targetValue = attr.value === "on" ? "off" : "on"
                actionUrl = encodeURI(`scriptable:///run?scriptName=${Script.name()}&action=${action}&room=${room.name}&device=${device.name}&attr=${attr.name}&value=${targetValue}`)
                shownAttr = {
                    deviceName: device.name,
                    attr: attr,
                    color: room.color,
                    url: actionUrl
                }
                shownAttrs.push(shownAttr)
            }
        }
    }

    while (shownAttrs.length < 4) {
        shownAttrs.push(
            {deviceName: "",
             attr: {name: "", value: ""},
             color: new Color("#ffffff", 0),
             url: null})
    }

    return shownAttrs
}

function addRoomName(rn, roomName) {
    rn.addSpacer(CONF.widgetPadding * 10)
    name = rn.addText(roomName)
    name.font = Font.systemFont(12)
}

function drawDeviceAttr(shownAttr){
    size = 180
    dc =new DrawContext()
    dc.opaque = false
    dc.respectScreenScale = true
    dc.size = new Size(size, size)
    dc.setTextColor(Color.white())
    dc.setFont(Font.boldRoundedSystemFont(30))
    dc.setFillColor(shownAttr.color)

    path = new Path()
    rect = new Rect(0, 0, size, size)
    path.addRoundedRect(rect, 30, 30)
    dc.addPath(path)
    dc.fillPath()
    dc.setTextAlignedLeft()
    attrInfo = `\n ${shownAttr.deviceName}\n ${shownAttr.attr.name}\n ${shownAttr.attr.value}`
    dc.drawTextInRect(attrInfo, rect)
    return dc.getImage()
}

async function raspiot(houseTable) {
    house = "raspiot home"
    houseTable.removeAllRows()
    title = new UITableRow()
    title.isHeader = true
    title.backgroundColor = titleColor()
    setting = title.addButton("⚙︎")
    setting.widthWeight = 20
    setting.leftAligned()
    setting.onTap = () => {
        showUiSetting()
    }
    houseName = title.addText(house)
    houseName.widthWeight = 80
    houseName.centerAligned()
    menu = title.addButton("•••")
    menu.widthWeight = 20
    menu.rightAligned()
    menu.onTap = () => {
        handleRoom(houseTable)
    }
    houseTable.addRow(title)

    rooms = await getRoomList()
    if (rooms === null) {
        if (CONF.raspiotEndpoint === "http://") {
            msg = "Set raspiot-server's ip at first."
        } else {
            msg = "Pls check network or raspiot-server."
        }
        msgRow = new UITableRow()
        msgRow.addText(`⬆️↖️${msg}`,
                       "             Tap here to retry.")
        msgRow.dismissOnSelect = false
        msgRow.height = 60
        msgRow.onSelect = () => {
            raspiot(houseTable)
        }
        houseTable.addRow(msgRow)
    }
    for (r in rooms) {
        let room = rooms[r]
        roomRow = new UITableRow()
        roomRow.dismissOnSelect = false
        roomRow.onSelect = () => {
            showRoom(room.name)
        }
        roomName = roomRow.addText(room.name)
        roomName.centerAligned()
        houseTable.addRow(roomRow)
    }
    houseTable.reload()
}

async function showUiSetting() {
    settingTable = new UITable()
    uiSetting(settingTable)
    settingTable.present(fullscreen=false)
}

async function uiSetting(settingTable) {
    settingTable.removeAllRows()
    title = new UITableRow()
    title.isHeader = true
    title.backgroundColor = titleColor()
    title.addText("settings").centerAligned()
    settingTable.showSeparators = true
    settingTable.addRow(title)

    ipRow = new UITableRow()
    ipRow.addText("Raspiot-server's ip").leftAligned()
    currentIp = CONF.raspiotEndpoint.split("http://")[1]
    ip = ipRow.addButton(currentIp || "-------------")
    ip.rightAligned()
    ip.onTap = () => {
        let input =  new Alert()
        input.title = "Input raspiot-server's IP"
        input.addTextField("raspiot-server's LAN IP", currentIp)
        input.addAction("OK")
        input.addCancelAction("Cancel")
        input.presentAlert().then(idx => {
            if(idx === 0) {
                CONF.raspiotEndpoint = `http://${input.textFieldValue(0)}`
                saveConfig()
                uiSetting(settingTable)
            }
        })
    }
    settingTable.addRow(ipRow)

    ipTest = new UITableRow()
    ipTest.addText("Serviceability test").leftAligned()
    serviceabilityTest().then(usability => {
        testResult = ipTest.addText(usability)
        available = usability === "available"
        testResult.titleColor = available ? Color.green() : Color.yellow()
        testResult.rightAligned()
        settingTable.reload()
    })
    ipTest.dismissOnSelect = false
    ipTest.onSelect = () => {
        uiSetting(settingTable)
    }
    settingTable.addRow(ipTest)

    settingSeparator = new UITableRow()
    settingSeparator.height = 10
    settingTable.addRow(settingSeparator)

    widgetShow = new UITableRow()
    widgetShow.addText("Widget setting").leftAligned()
    widgetShow.addText("❯").rightAligned()
    widgetShow.dismissOnSelect = false
    settingTable.addRow(widgetShow)
    widgetShow.onSelect = async () => {
        filters = {detail: "true",
                   sort_key: "room_id"}
        devices = await getDeviceList(filters)
        if (devices === null) {
            notification("Unable to set widget",
                "service unavailable")
            return
        }
        widgetSettingTable = new UITable()
        setWidgetAttr(widgetSettingTable, devices)
        widgetSettingTable.showSeparators = true
        widgetSettingTable.present(false)
    }

    settingTable.addRow(settingSeparator)
    aboutRow = new UITableRow()
    aboutRow.addText("About").leftAligned()
    aboutRow.addText("❯").rightAligned()
    aboutRow.dismissOnSelect = false
    aboutRow.onSelect = () => {
        showAboutInfo()
    }
    settingTable.addRow(aboutRow)
    settingTable.reload()
}

function showAboutInfo() {
    aboutTable = new UITable()
    title = new UITableRow()
    title.addText("About").centerAligned()
    title.isHeader = true
    aboutTable.addRow(title)

    blankRow = new UITableRow()
    blankRow.height = 160
    aboutTable.addRow(blankRow)

    iconRow = new UITableRow()
    iconRow.addImageAtURL(imgUri("icon")).centerAligned()
    iconRow.height = 220
    iconRow.dismissOnSelect = false
    iconRow.onSelect = () => {
        link = "https://github.com/huang-xinjie"
        QuickLook.present(link)
    }
    aboutTable.addRow(iconRow)
    aboutTable.addRow(blankRow)

    aboutRow = new UITableRow()
    about = aboutRow.addText("raspiot\nBy Huang Xinjie\nMade in China")
    about.titleColor = Color.gray()
    about.centerAligned()
    aboutRow.height = 120
    aboutTable.addRow(aboutRow)
    aboutTable.present(fullscreen=false)
}

async function setWidgetAttr(table, devices, selected) {
    selected = selected || new Set(CONF.widgetShownAttr)
    table.removeAllRows()
    title = new UITableRow()
    title.isHeader = true
    title.backgroundColor = titleColor()
    cancel = title.addButton("Cancel")
    cancel.dismissOnTap = true
    cancel.widthWeight = 15
    cancel.leftAligned()
    name = title.addText("widget setting",
        "select device attr for widget show")
    name.widthWeight = 80
    name.centerAligned()
    done = title.addButton("Save")
    done.dismissOnTap = true
    done.widthWeight = 15
    done.rightAligned()
    done.onTap = () => {
        CONF.widgetShownAttr = [...selected]
        saveConfig()
    }
    table.addRow(title)

    blank = new UITableRow()
    blank.height = 10

    for (d in devices) {
        let device = devices[d]
        deviceRow = new UITableRow()
        deviceRow.addText(device.name).centerAligned()
        table.addRow(deviceRow)
        for (a in device.attrs) {
            let attr = device.attrs[a]
            attrRow = new UITableRow()
            attrRow.dismissOnSelect = false
            attrRow.addText(attr.name).leftAligned()
            attrKey = `${device.uuid}:${attr.name}`
            if (selected.has(attrKey)) {
                attrRow.addText("✔️").rightAligned()
            }
            table.addRow(attrRow)
            attrRow.onSelect = () => {
                attrKey = `${device.uuid}:${attr.name}`
                if (selected.has(attrKey)) {
                    selected.delete(attrKey)
                } else {
                    selected.add(attrKey)
                }
                setWidgetAttr(table, devices, selected)
            }
        }
        table.addRow(blank)
    }
    table.reload()
}

async function serviceabilityTest() {
    url = encodeURI(`${CONF.raspiotEndpoint}/`)
    req = new Request(url)
    req.timeoutInterval = 2
    return new Promise(async function(resolve, reject) {
        try {
            await req.load()
            resolve("available")
        } catch (error) {
            log("service unavailable.")
            resolve("unavailable")
        }
    })
}

async function getRoomList() {
    url = encodeURI(`${CONF.raspiotEndpoint}/rooms`)
    req = new Request(url)
    req.timeoutInterval = 2
    try {
        return await req.loadJSON()
    } catch (error) {
        log("get room list failed.")
        return null
    }
}

async function showRoom(roomName, onShow) {
    roomTable = new UITable()
    roomTable.showSeparators = true
    inRoom(roomTable, roomName, onShow)
    roomTable.present(fullscreen=false)
}

async function inRoom(table, room, onShow, realtime) {
    if (roomInProcess || !table) {
        log(`room in process: ${roomInProcess}, skip.`)
        return
    }

    onShow = onShow || new Set()
    realtime = realtime || false
    roomInProcess = true
    table.removeAllRows()
    title = new UITableRow()
    title.isHeader = true
    title.backgroundColor = titleColor()
    live = title.addButton("live")
    live.leftAligned()
    live.widthWeight =10
    live.onTap = () => {
        inRoom(table, room, onShow, true)
    }
    roomName = title.addText(room)
    roomName.centerAligned()
    roomName.widthWeight = 80
    menu = title.addButton("•••")
    menu.rightAligned()
    menu.widthWeight = 10
    menu.onTap = () => {
        handleDevice(table, room)
    }
    table.addRow(title)

    filters = {room: room, detail: "true"}
    devices = await getDeviceList(filters)
    for (d in devices) {
        let device = devices[d]
        deviceRow = new UITableRow()
        deviceRow.dismissOnSelect = false
        deviceRow.onSelect = () => {
            if (onShow.has(device.name)) {
                log(`stop showing ${device.name}`)
                onShow.delete(device.name)
            } else {
                onShow.add(device.name)
            }
            inRoom(table, room, onShow)
        }
        deviceRow.addText("").widthWeight = 15
        deviceName = deviceRow.addText(device.name)
        deviceName.centerAligned()
        deviceName.widthWeight = 70
        icon = device.status === "online" ? "🟢" : "🟠"
        status = deviceRow.addText(icon)
        status.rightAligned()
        status.widthWeight = 15
        table.addRow(deviceRow)
        if (onShow.has(device.name)) {
            if (!await showDevice(table, room, device, realtime)) {
                log(`failed to show ${device.name}`)
                onShow.delete(device.name)
            }
        }
    }
    table.reload()
    roomInProcess = false
}

async function handleRoom(houseTable) {
    let alert = new Alert()
    alert.title = "Handle room"
    alert.addAction("Add room")
    alert.addAction("Rename room")
    alert.addDestructiveAction("Remove room")
    alert.addCancelAction("Cancel")
    alert.presentSheet().then(async idx => {
        rooms = await getRoomList()
        if(idx === 0)
            addRoom(houseTable, rooms)
        else if(idx === 1)
            renameRoom(houseTable, rooms)
        else if(idx === 2)
            delRoom(houseTable, rooms)
    })
}

function addRoom(houseTable, rooms) {
    let alert = new Alert()
    alert.title = "Add room"
    alert.addTextField("room name")
    alert.addAction("Add")
    alert.addCancelAction("Cancel")
    alert.present().then(async idx => {
        let room = alert.textFieldValue(0)
        if(idx ===0 && room.length > 0) {
            if(rooms.indexOf(room) === -1) {
                await addRoomReq(room)
                raspiot(houseTable)
            } else {
                notification("Add room failed", `${room} already exists`)
            }
        }
    })
}

async function addRoomReq(room) {
    url = encodeURI(`${CONF.raspiotEndpoint}/room`)
    let req = new Request(url)
    req.method = "POST"
    req.timeoutInterval = 10
    req.headers = {"Content-Type": "application/json"}
    req.allowInsecureRequest = true
    req.addParameterToMultipart("name", room)
    try {
        response = await req.loadJSON()
        if ((response.code || 200) !== 200) {
            notification(`Add room ${room} failed`, response.message)
        }
    } catch (error) {
        notification(`Add room ${room} failed`, "pls check network or raspiot-server.")
    }
}

async function renameRoom(houseTable, rooms) {
    let alert = new Alert()
    roomNameList = []
    alert.title = "Rename room"
    for (r in rooms) {
        alert.addAction(rooms[r].name)
        roomNameList.push(rooms[r].name)
    }
    alert.addCancelAction("Cancel")
    alert.presentSheet().then(idx => {
        if(idx < rooms.length) {
            let oldName = rooms[idx].name
            let checkbox =  new Alert()
            checkbox.title = `Rename ${oldName}`
            checkbox.addTextField("Input the new  room name", oldName)
            checkbox.addAction("Rename")
            checkbox.addCancelAction("Cancel")
            checkbox.presentAlert().then(async idx => {
                let newName = checkbox.textFieldValue(0)
                if(idx === 0) {
                    if(roomNameList.indexOf(newName) === -1) {
                        await updateRoomReq(oldName, newName)
                        raspiot(houseTable)
                    } else {
                        notification("rename failed", `${newName} already exists`)
                    }
                }
            })
        }
    })
}

async function updateRoomReq(room, newName) {
    url = encodeURI(`${CONF.raspiotEndpoint}/room/${room}`)
    let req = new Request(url)
    req.method = "PUT"
    req.timeoutInterval = 5
    req.headers = {"Content-Type": "application/json"}
    req.allowInsecureRequest = true
    req.addParameterToMultipart("name", newName)

    try {
        response = await req.load()
        if ((response.code || 200) !== 200) {
            notification(`Update room ${room} failed`, response.message)
        }
    } catch (error) {
        notification("Update room failed", "pls check network or raspiot-server.")
    }
}

async function delRoom(houseTable, rooms) {
    let alert = new Alert()
    alert.title = "Remove room"
    for (r in rooms) {
        alert.addAction(rooms[r].name)
    }
    alert.addCancelAction("Cancel")
    alert.presentSheet().then(idx => {
        if(idx >=0 && idx < rooms.length) {
            let room = rooms[idx].name
            let checkbox = new Alert()
            checkbox.title = "Remove room"
            checkbox.message = `Confirm to remove the ${room}?`
            checkbox.addDestructiveAction("Remove")
            checkbox.addCancelAction("Cancel")
            checkbox.presentAlert().then(async idx => {
                if(idx === 0) {
                    await delRoomReq(room)
                    raspiot(houseTable)
                }
            })
        }
    })
}

async function delRoomReq(room) {
    url = encodeURI(`${CONF.raspiotEndpoint}/room/${room}`)
    let req = new Request(url)
    req.method = "DELETE"
    req.timeoutInterval = 5
    req.headers = {"Content-Type": "application/json"}
    req.allowInsecureRequest = true

    try {
        await req.load()
    } catch (error) {
        notification(`Remove room ${room} failed`, "pls check network or raspiot-server.")
    }
}

async function getDeviceList(filters) {
    url = encodeURI(`${CONF.raspiotEndpoint}/devices`)
    param = ""
    for (k in filters) {
        param += `&${k}=${encodeURIComponent(filters[k])}`
    }
    url += param ? "?" + param.substring(1) : ""

    let req = new Request(url)
    req.timeoutInterval = 5
    try {
        return await req.loadJSON()
    } catch (error) {
        log(`Get device list failed: ${error}`)
        return null
    }
}

async function getDeviceAttrs(deviceUuid, realtime) {
    url = encodeURI(`${CONF.raspiotEndpoint}/device/${deviceUuid}?realtime=${realtime}`)
    let req = new Request(url)
    req.timeoutInterval = 5
    try {
        return await req.loadJSON()
    } catch (error) {
        notification("Get device attrs failed", error + "pls check network or raspiot-server.")
    }
}

async function showDevice(table, room, device, realtime) {
    log(`show ${device.name}`)
    if (realtime) {
        device = await getDeviceAttrs(device.uuid, realtime)
        // log("device attrs: " + JSON.stringify(device.attrs, null, 2))
    }
    for (a in device.attrs) {
        row = new UITableRow()
        row.dismissOnSelect = false
        row.backgroundColor = device.status === "online" ? Color.green() : Color.orange()
        let attr = device.attrs[a]
        row.addText(attr.name).leftAligned()
        if (attr.type === "text") {
            if (attr.read_only) {
                row.addText(attr.value).rightAligned()
            } else {
                text = row.addButton(attr.value)
                text.rightAligned()
                text.onTap = () => {
                    dealText(table, room, device, attr)
                }
            }
        } else if (attr.type === "select") {
            select = row.addButton(attr.value)
            select.rightAligned()
            select.onTap = () => {
                dealSelect(table, room, device, attr)
            }
        } else if (attr.type === "stream") {
            stream = row.addButton(attr.value)
            stream.rightAligned()
            stream.onTap = () => {
                dealStream(table, room, device, attr)
            }
        } else if (attr.type === "image") {
            row.addImageAtURL(attr.value)
        } else if (attr.type === "button") {
            button = row.addImageAtURL(imgUri("button"))
            button.rightAligned()
            // UITableCell中只有button类型Cell支持触摸事件，button不支持指定图标，这里用row的选择事件代替
            row.onSelect = () => {
                setAttr(table, room, device, attr.name, attr.value)
            }
        } else if (attr.type === "switch") {
            switchIcon = row.addImageAtURL(imgUri(attr.value))
            switchIcon.rightAligned()
            row.onSelect = () => {
                reverse = attr.value === "on" ? "off" : "on"
                setAttr(table, room, device, attr.name, reverse)
            }
        } else if (attr.type === "range") {
            range = row.addButton(attr.value)
            range.rightAligned()
            range.onTap = () => {
                setRange(table, room, device, attr)
          }
        }
        table.addRow(row)
    }

    if (!device.attrs.length) {
        notification("Unable to show attrs",
            `device ${device.name} never connected, unable to get device attrs. Pls check the device.`)
        return false
    }
    return true
}

function dealText(table, room, device, attr) {
    input = new Alert()
    input.title = "Set " + attr.name
    input.addTextField(attr.value, attr.value)
    input.addAction("OK")
    input.addCancelAction("Cancel")
    input.presentAlert().then(idx => {
        if(idx === 0) {
            inputValue = input.textFieldValue(0)
            log("deal text " + inputValue)
            setAttr(table, room, device, attr.name, inputValue)
        }
    })
}

function dealStream(table, room, device, attr) {
    let streamView = new WebView()
    log(attr.value)
    streamView.loadURL(attr.value)
    streamView.waitForLoad()
    streamView.present()
}

function dealSelect(table, room, device, attr) {
    log("select " + attr.name)
    let alert = new Alert()
    alert.title = "select " + attr.name
    options = attr.value_constraint.options
    for (o in options) {
        alert.addAction(options[o])
    }
    alert.addCancelAction("cancel")
    alert.presentSheet().then(idx => {
        if(idx !== -1) {
            setAttr(table, room, device, attr.name, options[idx])
        }
    })
}

function setRange(table, room, device, attr) {
    let alert = new Alert()
    alert.title = "set " + attr.name
    min = attr.value_constraint.min
    max = attr.value_constraint.max
    step = attr.value_constraint.step
    for (var i=min; i <= max; i+=step) {
        alert.addAction(String(i))
    }
    alert.addCancelAction("cancel")
    alert.presentSheet().then(idx => {
        if(idx !== -1) {
            setAttr(table, room, device, attr.name, String(idx * step + min))
        }
    })
}

async function setAttr(table, room, device, attrName, attrValue) {
    if (device.status === "offline") {
        notification("Fail to handle device",
            `${device.name} is offline`)
        return
    }

    url = encodeURI(`${CONF.raspiotEndpoint}/device/${device.uuid}/attr`)
    let req = new Request(url)
    req.method = "PUT"
    req.timeoutInterval = 10
    req.headers = {"Content-Type": "application/json"}
    req.allowInsecureRequest = true
    req.addParameterToMultipart("attr", attrName)
    req.addParameterToMultipart("value", attrValue)

    try {
        await req.loadJSON()
    } catch (error) {
        notification("Set device attr failed", error)
    }
    inRoom(table, room, new Set([device.name]))
}

function imgUri(value) {
    onUri = `${CONF.raspiotEndpoint}/statics/switch_on.png`
    offUri = `${CONF.raspiotEndpoint}/statics/switch_off.png`
    iconUri = `${CONF.raspiotEndpoint}/statics/raspiot.png`
    buttonUri = `${CONF.raspiotEndpoint}/statics/button.png`
    loadingUri = `${CONF.raspiotEndpoint}/statics/loading.png`

    uriMapping = {
        on: onUri,
        off: offUri,
        icon: iconUri,
        button: buttonUri,
        loading: loadingUri
    }
    return uriMapping[value]
}

function handleDevice(table, room) {
    let alert = new Alert()
    alert.title = "Handle device"
    alert.addAction("Add device")
    alert.addAction("Update device")
    alert.addDestructiveAction("Remove device")
    alert.addCancelAction("Cancel")
    alert.presentSheet().then(idx => {
        if(idx === 0)
            addDevice(table, room)
        else if(idx === 1)
            selectUpdateDevice(table, room)
        else if(idx === 2)
            selectDelDevice(table, room)
    })
}

async function addDevice(table, room) {
    device = await scanDeviceInfo()
    let alert = new Alert()
    alert.title = "Add device"
    alert.addTextField("* device name", device.name)
    alert.addTextField("* mac address", device.mac_addr)
    alert.addTextField("* protocol", device.protocol)
    alert.addTextField("* port", String(device.port))
    alert.addTextField("  ipv4 address")
    alert.addTextField("  ipv6 address")
    alert.addTextField("  sync mode", device.sync_mode)
    alert.addTextField("  sync interval", device.sync_interval)
    alert.addTextField("  token", device.token)
    alert.addAction("Add")
    alert.addCancelAction("Cancel")
    alert.present().then(async idx => {
        if(idx === 0) {
            device.name = alert.textFieldValue(0)
            device.mac_addr = alert.textFieldValue(1)
            device.protocol = alert.textFieldValue(2)
            device.port = alert.textFieldValue(3)
            device.ipv4_addr = alert.textFieldValue(4)
            device.ipv6_addr = alert.textFieldValue(5)
            device.sync_mode = alert.textFieldValue(6)
            device.sync_interval = alert.textFieldValue(7)
            device.token = alert.textFieldValue(8)
            await addDeviceReq(room, device)
            log(`${room} add device: ${device.name}`)
            inRoom(table, room)
        }
    })
}

async function scanDeviceInfo() {
    scan = new CallbackURL("shortcuts://x-callback-url/run-shortcut")
    scan.addParameter("name", "qrcode-scan")
    try {
        scanResult = await scan.open()
        return JSON.parse(scanResult.result)
    } catch (error) {
        log(`scan failed: ${error}`)
        return {}
    }
}

async function addDeviceReq(room, device) {
    url = encodeURI(`${CONF.raspiotEndpoint}/device`)
    let req = new Request(url)
    req.method = "POST"
    req.timeoutInterval = 10
    req.headers = {"Content-Type": "application/json"}
    req.allowInsecureRequest = true
    req.addParameterToMultipart("name", device.name)
    if (device.mac_addr)
        req.addParameterToMultipart("mac_addr", device.mac_addr)
    if (device.protocol)
        req.addParameterToMultipart("protocol", device.protocol)
    if (device.port)
        req.addParameterToMultipart("port", device.port)
    if (device.ipv4_addr)
        req.addParameterToMultipart("ipv4_addr", device.ipv4_addr)
    if (device.ipv6_addr)
        req.addParameterToMultipart("ipv6_addr", device.ipv6_addr)
    if (device.sync_mode)
        req.addParameterToMultipart("sync_mode", device.sync_mode)
    if (device.sync_interval)
        req.addParameterToMultipart("sync_interval", device.sync_interval)
    if (device.token)
        req.addParameterToMultipart("token", device.token)
    req.addParameterToMultipart("room", room)
    try {
        response = await req.loadJSON()
        if ((response.code || 200) !== 200) {
            notification(`Add device ${device.name} failed`, response.message)
        }
    } catch (error) {
        notification("Add device failed", "pls check network or raspiot-server.")
    }
}

async function selectUpdateDevice(roomTable, room) {
    let alert = new Alert()
    alert.title = "Update device"
    alert.message = "Tap the device to update"

    filters = {room: room}
    devices = await getDeviceList(filters)
    for (d in devices) {
        alert.addAction(devices[d].name)
    }
    alert.addCancelAction("Cancel")
    alert.presentSheet().then(idx => {
        if(idx >= 0 && idx < devices.length) {
            updateDevice(roomTable, room, devices[idx])
        }
    })
}

async function updateDevice(roomTable, room, device) {
    let alert =  new Alert()
    alert.title = "Update device"
    alert.message = "Only the fields filled in will be updated"
    alert.addTextField(" device name", device.name)
    alert.addTextField(" mac address", device.mac_addr)
    alert.addTextField(" protocol", device.protocol)
    alert.addTextField(" port", String(device.port))
    alert.addTextField(" ipv4 address", device.ipv4_addr || "")
    alert.addTextField(" ipv6 address", device.ipv6_addr || "")
    alert.addTextField(" sync mode", device.sync_mode || "")
    alert.addTextField(" sync interval", String(device.sync_interval))
    alert.addTextField(" token", device.token || "")
    alert.addAction("Update")
    alert.addCancelAction("Cancel")
    alert.presentAlert().then(async idx => {
        if(idx === 0) {
            device.new_name = alert.textFieldValue(0)
            device.mac_addr = alert.textFieldValue(1)
            device.protocol = alert.textFieldValue(2)
            device.port = alert.textFieldValue(3)
            device.ipv4_addr = alert.textFieldValue(4)
            device.ipv6_addr = alert.textFieldValue(5)
            device.sync_mode = alert.textFieldValue(6)
            device.sync_interval = alert.textFieldValue(7)
            device.token = alert.textFieldValue(8)
            await updateDeviceReq(device)
            inRoom(roomTable, room)
        }
    })
}

async function updateDeviceReq(device) {
    url = encodeURI(`${CONF.raspiotEndpoint}/device/${device.uuid}`)
    let req = new Request(url)
    req.method = "PUT"
    req.timeoutInterval = 5
    req.headers = {"Content-Type": "application/json"}
    req.allowInsecureRequest = true
    if (device.new_name)
        req.addParameterToMultipart("name", device.new_name)
    if (device.mac_addr)
        req.addParameterToMultipart("mac_addr", device.mac_addr)
    if (device.protocol)
        req.addParameterToMultipart("protocol", device.protocol)
    if (device.port)
        req.addParameterToMultipart("port", device.port)
    if (device.ipv4_addr)
        req.addParameterToMultipart("ipv4_addr", device.ipv4_addr)
    if (device.ipv6_addr)
        req.addParameterToMultipart("ipv6_addr", device.ipv6_addr)
    if (device.sync_mode)
        req.addParameterToMultipart("sync_mode", device.sync_mode)
    if (device.sync_interval)
        req.addParameterToMultipart("sync_interval", device.sync_interval)
    if (device.token)
        req.addParameterToMultipart("token", device.token)

    try {
        response = await req.load()
        if ((response.code || 200) !== 200) {
            notification("Update device " + device.name + " failed", response.message)
        }
    } catch (error) {
        notification("Update device failed", "pls check network or raspiot-server.")
    }
}

async function selectDelDevice(roomTable, room) {
    let alert = new Alert()
    alert.title = "Remove device"
    alert.message = "Tap the device and it will be removed."

    filters = {room: room}
    devices = await getDeviceList(filters)
    for (d in devices) {
        alert.addDestructiveAction(devices[d].name)
    }
    alert.addCancelAction("Cancel")
    alert.presentSheet().then(idx => {
        if(idx >= 0 && idx < devices.length) {
            delDeviceConfirm(roomTable, room, devices[idx])
        }
    })
}

async function delDeviceConfirm(roomTable, room, device) {
    let checkbox =  new Alert()
    checkbox.title = "Remove device"
    checkbox.message = "Confirm to remove the " + device.name + "?"
    // checkbox.addTextField("Input the device name for confirm.")
    checkbox.addDestructiveAction("Remove")
    checkbox.addCancelAction("Cancel")
    checkbox.presentAlert().then(async idx => {
        if(idx === 0) {
            // if(checkbox.textFieldValue(0) === device.name) {
                await delDeviceReq(device)
                console.log(device.name + " is removed.")
                inRoom(roomTable, room)
            /*} else {
                console.log("Input no match, remove cancel.")
            }*/
        }
    })
}

async function delDeviceReq(device) {
    url = encodeURI(`${CONF.raspiotEndpoint}/device/${device.uuid}`)
    let req = new Request(url)
    req.method = "DELETE"
    req.timeoutInterval = 5
    req.headers = {"Content-Type": "application/json"}
    req.allowInsecureRequest = true

    try {
        await req.load()
    } catch (error) {
        notification("Remove device failed", "pls check network or raspiot-server.")
    }
}

function titleColor() {
    if (Device.isUsingDarkAppearance()) {
        return Color.gray()
    } else {
        return new Color("#EDEDED")
    }
}

function notification(title, body) {
    notify = new Notification()
    notify.title = title
    notify.body = body
    notify.identifier = "raspiotNotification"
    notify.schedule()
    Notification.removeDelivered([notify.identifier])
}
