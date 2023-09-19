// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: sitemap;
var para = args.queryParameters
log(para)
raspiot_ip = para.ip || "192.168.31.242"    // replace with your raspiot-server's LAN IP
const raspiot_endpoint = "http://" + raspiot_ip
log(raspiot_endpoint)
main()

function main() {
    action = ["smart home"]
    alert = new Alert()
    alert.title = "raspiot"
    for (a in action) {
        alert.addAction(action[a])
    }
    
    alert.addCancelAction("exit")
    alert.presentSheet().then(idx => {
        if(idx == 0)
            raspiot()
    })
}

async function raspiot() {
    house = "raspiot home"
    rooms = await get_room_list(house)
    house_table = new UITable()
    house_table.showSeparators = true
    title = new UITableRow()
    title.isHeader = true
    title.backgroundColor = Color.blue()
    back = title.addButton("🔚")
    back.leftAligned()
    back.widthWeight =10
    back.dismissOnTap = true
    back.onTap = () => {
        log("exit")
    }
    room_name = title.addText(house)
    room_name.centerAligned()
    room_name.widthWeight = 80
    menu = title.addButton("📋")
    menu.rightAligned()
    menu.widthWeight = 10
    menu.onTap = () => {
        handle_room(house)
    }
    house_table.addRow(title)

    for (r in rooms) {
        let room = rooms[r]
        room_row = new UITableRow()
        room_row.dismissOnSelect = false
        room_row.onSelect = () => {
            room_table = new UITable()
            room_table.showSeparators = true
            in_room(room_table, room.name)
            room_table.present(fullscreen=false)
        }
        room_ui = room_row.addText(room.name)
        room_ui.centerAligned()
        house_table.addRow(room_row)
    }
    house_table.present(fullscreen=true)
}

async function in_room(table, room, select, on_show) {
    select = select || ""
    on_show = on_show || ""
    devices = await get_device_list(room)
    log("tap " + select)
    table.removeAllRows()
    title = new UITableRow()
    title.isHeader = true
    title.backgroundColor = Color.blue()
    back = title.addButton("🔙")
    back.leftAligned()
    back.widthWeight =10
    back.dismissOnTap = true
    back.onTap = () => {
        log("back to raspiot")
    }
    room_name = title.addText(room)
    room_name.centerAligned()
    room_name.widthWeight = 80
    menu = title.addButton("📋")
    menu.rightAligned()
    menu.widthWeight = 10
    menu.onTap = () => {
        handle_device(room)
    }
    table.addRow(title)

    for (d in devices) {
        let device = devices[d]
        device_row = new UITableRow()
        device_row.dismissOnSelect = false
        device_row.onSelect = () => {
            on_select = select == on_show ? "" : select
            log("select " + device.name)
            in_room(table, room, device.name, on_select)
        }
        device_row.addText("").widthWeight = 15
        device_ui = device_row.addText(device.name)
        device_ui.centerAligned()
        device_ui.widthWeight = 70
        icon = device.status == "online" ? "🟢" : "🟠"
        status = device_row.addText(icon)
        status.rightAligned()
        status.widthWeight = 15
        table.addRow(device_row)
        if (device.name == select && select != on_show) {
            await show_device(table, room, device)
        }
    }
    table.reload()
}

function handle_room(house) {
    let alert = new Alert()
    alert.title = "handle room"
    alert.addAction("➕ add room")
    alert.addAction("🔄 rename room")
    alert.addDestructiveAction("➖  remove room")
    alert.addCancelAction("cancel")
    alert.presentSheet().then(idx => {
        if(idx == 0)
            add_room(house)
        else if(idx == 1)
            rename_room(house)
        else if(idx == 2)
            delroom(house)
    })
}

function add_room(house) {
    let alert = new Alert()
    alert.title = "add room"
    alert.addTextField("room name")
    alert.addAction("ok")
    alert.addCancelAction("cancel")
    alert.present().then(idx => {
        let room = alert.textFieldValue(0)
        if(room.length > 0) {
            let rooms = get_room_list(house)
            if(rooms.indexOf(room) == -1)
                log("new room")
            else
                log(room + " is exists.")
            // send request to raspiot-server
        }
        raspiot()
    })
}

function rename_room(house) {
    let rooms = get_room_list(house)
    let alert = new Alert()
    alert.title = "rename room"
    for (r in rooms) {
        alert.addAction(rooms[r])
    }
    alert.addCancelAction("cancel")
    alert.presentSheet().then(idx => {
        if(idx == -1)
            raspiot()
        else if(idx < rooms.length) {
            let oldroom = rooms[idx]
            let checkbox =  new Alert()
            checkbox.title = "rename " + oldroom + " to"
            checkbox.addTextField("input the room name")
            checkbox.addDestructiveAction("rename")
            checkbox.addCancelAction("cancel")
            checkbox.presentAlert().then(idx => {
                let newroom = checkbox.textFieldValue(0)
                if(idx == 0) {
                    if(rooms.indexOf(newroom) == -1) {
                        console.log(oldroom + " is renamed to "+ newroom)
                    } else {
                        console.log(oldroom + " is exists")
                    }
                }
                raspiot()
            })
        }
    })
}

function delroom(house) {
    let rooms = get_room_list(house)
    let alert = new Alert()
    alert.title = "remove room"
    for (r in rooms) {
        alert.addAction(rooms[r])
    }
    alert.addCancelAction("cancel")
    alert.presentSheet().then(idx => {
        if(idx == -1)
            raspiot()
        else if(idx < rooms.length) {
            let room = rooms[idx]
            let checkbox =  new Alert()
            checkbox.title = "Are you sure to remove the " + room + "?"
            checkbox.addTextField("input the room name")
            checkbox.addDestructiveAction("remove")
            checkbox.addCancelAction("cancel")
            checkbox.presentAlert().then(idx => {
                if(idx == 0) {
                    if(checkbox.textFieldValue(0) == room)
                        console.log(room + " is removed.")
                    else
                        console.log("input no match. remove cancel.")
                } else {
                    raspiot()
                }
            })
        }
    })
}

async function get_room_list(house) {
    url = raspiot_endpoint + "/rooms"
    req = new Request(url)
    req.timeoutInterval = 5
    rooms = await req.loadJSON()
    log(rooms)
    return rooms
}

function handle_device(room) {
    let alert = new Alert()
    alert.title = "handle device"
    alert.addAction("➕ add device")
    alert.addAction("🔄 rename device")
    alert.addDestructiveAction("➖  remove device")
    alert.addCancelAction("back")
    alert.presentSheet().then(idx => {
        if(idx == -1)
            in_room(room)
        else if(idx == 0)
            add_device(room)
        else if(idx == 1)
            rename_device(room)
        else if(idx == 2)
            del_device(room)
    })
}

async function show_device(table, room, device) {
    log("show " + device.name)
    device = await get_device_attrs(device.uuid)
    for (d in device.attrs) {
        row = new UITableRow()
        row.dismissOnSelect = false
        row.backgroundColor = device.status == "online" ? Color.green() : Color.yellow()
        let attr = device.attrs[d]
        row.addText(attr.name).leftAligned()
        if (attr.type == "text") {
            if (attr.read_only) {
                row.addText(attr.value).rightAligned()
            } else {
                text = row.addButton(attr.value)
                text.rightAligned()
                text.onTap = () => {
                    deal_text(table, room, device, attr)
                }
            }
        } else if (attr.type == "select") {
            select = row.addButton(attr.value)
            select.rightAligned()
            select.onTap = () => {
                deal_select(table, room, device, attr)
            }
        } else if (attr.type == "stream") {
            stream = row.addButton(attr.value)
            stream.rightAligned()
            stream.onTap = () => {
                deal_stream(table, room, device, attr)
            }
        }  else if (attr.type == "image") {
            row.addImageAtURL(attr.value)
        } else if (attr.type == "button") {
            button = row.addButton(attr.name)
            button.rightAligned()
            button.onTap = () => {
                set_attr(table, room, device, attr.name, attr.value)
            }
        } else if (attr.type == "switch") {
            switch_uri = get_switch_uri(attr.value)
            switch_icon = row.addImageAtURL(switch_uri)
            switch_icon.rightAligned()
            // UITableCell中只有button支持触摸事件，这里用row的选择事件代替
            row.onSelect = () => {
                set_attr(table, room, device, attr.name, String(!attr.value))
            }
        } else if (attr.type == "range") {
            range = row.addButton(attr.value)
            range.rightAligned()
            range.onTap = () => {
                set_range(table, room, device, attr)
          }
        }
        table.addRow(row)
    }
}

function deal_text(table, room, device, attr) {
    input = new Alert()
    input.title = "Set " + attr.name
    input.addTextField(attr.value)
    input.addDestructiveAction("OK")
    input.addCancelAction("Cancel")
    input.presentAlert().then(idx => {
        if(idx == 0) {
            input_value = input.textFieldValue(0)
            log("deal text " + input_value)
            set_attr(table, room, device, attr.name, input_value)
        }
    })
}

function deal_stream(table, room, device, attr) {
    let web_view = new WebView()
    log(attr.value)
    web_view.loadURL(attr.value)
    web_view.waitForLoad()
    web_view.present()
}

function deal_select(table, room, device, attr) {
    log("select " + attr.name)
    let alert = new Alert()
    alert.title = "select " + attr.name
    options = attr.value_constraint.options
    for (o in options) {
        alert.addAction(options[o])
    }
    alert.addCancelAction("cancel")
    alert.presentSheet().then(idx => {
        if(idx != -1) {
            set_attr(table, room, device, attr.name, options[idx])
        }
    })
}

function set_range(table, room, device, attr) {
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
        if(idx != -1) {
            set_attr(table, room, device, attr.name, String(idx * step + min))
        }
    })
}

async function set_attr(table, room, device, attr_name, attr_value) {
    if (device.status == "offline") {
        notify = new Notification()
        notify.title = "Fail to handle device"
        notify.body = "device is offline"
        notify.schedule()
        return
    }

    url = raspiot_endpoint + "/device/" + device.uuid + "/attr"
    let req = new Request(url)
    req.method="PUT"
    req.timeoutInterval = 10
    req.headers = {"Content-Type": "application/json"}
    req.allowInsecureRequest = true
    req.addParameterToMultipart("attr", attr_name)
    req.addParameterToMultipart("value", attr_value)
    await req.loadJSON()
    log(req)
    in_room(table, room, device.name)
}

function get_switch_uri(value) {
    switch_on_uri = raspiot_endpoint + "/statics/switch_on.png"
    switch_off_uri = raspiot_endpoint + "/statics/switch_off.png"
    if (value) {
        return switch_on_uri
    }
    return switch_off_uri
}

function add_device(room) {
    let alert = new Alert()
    alert.title = "add device"
    alert.addTextField("device name")
    alert.addTextField("device mac address")
    alert.addAction("ok")
    alert.addCancelAction("cancel")
    alert.present().then(idx => {
        if(idx == -1)
            in_room(room)
    })
}

function del_device(room) {
    let devices = get_device_list(room)
    let alert = new Alert()
    alert.title = "remove device"
    for (d in devices) {
        alert.addAction(devices[d])
    }
    alert.addCancelAction("cancel")
    alert.presentSheet().then(idx => {
        if(idx == -1)
            raspiot()
        else if(idx < devices.length) {
            let device = devices[idx]
            let checkbox =  new Alert()
            checkbox.title = "Are you sure to remove the " + device + "?"
            checkbox.addTextField("input the device name")
            checkbox.addDestructiveAction("remove")
            checkbox.addCancelAction("cancel")
            checkbox.presentAlert().then(idx => {
                if(idx == 0) {
                    if(checkbox.textFieldValue(0) == device)
                        console.log(device + " is removed.")
                    else
                        console.log("input no match. remove cancel.")
                } else {
                    in_room(room)
                }
            })
        }
    })
}

async function get_device_list(room) {
    url = raspiot_endpoint + "/devices?room=" + room
    let req = new Request(url)
    req.timeoutInterval = 5
    let devices = await req.loadJSON()
    log(devices)
    return devices
}

async function get_device_attrs(device_uuid) {
    url = raspiot_endpoint + "/device/" + device_uuid
    let req = new Request(url)
    req.timeoutInterval = 5
    let attrs = await req.loadJSON()
    return attrs
}

function pi_status() {
    status = "ip: " + raspiot_ip + "\n"
    status += "run time: 16mins\n"
    alert = new Alert()
    alert.title = "pi's status"
    alert.message = status
    alert.addCancelAction("back")
    alert.presentSheet().then(idx => {
        if(idx == -1)
            main()
    })
}

function shutdown() {
    let alert = new Alert()
    alert.title = "Are you sure to shut down?"
    alert.addDestructiveAction("shut down")
    alert.addCancelAction("cancel")
    alert.presentSheet().then(idx => {
        if(idx == 0)
            log("shutdown pi")
        else if(idx == -1)
            main()
    })
}
