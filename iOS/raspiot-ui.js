// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: sitemap;
raspiot_endpoint = ""
room_in_process = false
main()

function main() {
    var args_para = args.queryParameters
    log("args: " + JSON.stringify(args_para))
    raspiot_ip = args_para.ip || ""    // replace with your raspiot-server's LAN IP
    if (raspiot_ip) {
        raspiot_endpoint = "http://" + raspiot_ip
        raspiot()
    } else {
        let input =  new Alert()
        input.title = "Input raspiot-server's IP"
        input.addTextField("raspiot-server's LAN IP")
        input.addAction("OK")
        input.addCancelAction("Cancel")
        input.presentAlert().then(idx => {
            if(idx == 0) {
                raspiot_endpoint = "http://" + input.textFieldValue(0)
                raspiot()
            }
        })
    }
}

async function raspiot() {
    house = "raspiot home"
    house_table = new UITable()
    title = new UITableRow()
    title.isHeader = true
    title.backgroundColor = title_color()
    back = title.addButton("🔚")
    back.leftAligned()
    back.widthWeight =10
    back.dismissOnTap = true

    room_name = title.addText(house)
    room_name.centerAligned()
    room_name.widthWeight = 80
    menu = title.addButton("•••")
    menu.widthWeight = 10
    menu.rightAligned()
    menu.onTap = () => {
        handle_room(house)
    }
    house_table.addRow(title)

    loading = new UITableRow()
    loading.addImageAtURL(icon_uri("loading")).centerAligned()
    loading.height = 30
    house_table.addRow(loading)
    house_table.present(fullscreen=true)

    rooms = await get_room_list(house)
    house_table.showSeparators = true
    house_table.removeRow(loading)
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
    house_table.reload()
}

async function get_room_list(house) {
    url = raspiot_endpoint + "/rooms"
    req = new Request(url)
    req.timeoutInterval = 2
    try {
        return await req.loadJSON()
    } catch (error) {
        notification("Get room list failed", "pls check network and raspiot-server.")
        return []
    }
}

async function in_room(table, room, select, on_show, realtime) {
    if (room_in_process) {
        log("room in process, skip.")
        return
    }

    select = select || ""
    on_show = on_show || ""
    realtime = realtime || false
    room_in_process = true
    table.removeAllRows()
    title = new UITableRow()
    title.isHeader = true
    title.backgroundColor = title_color()
    live = title.addButton("live")
    live.leftAligned()
    live.widthWeight =10
    live.onTap = () => {
        in_room(table, room, select, on_show, true)
    }
    room_name = title.addText(room)
    room_name.centerAligned()
    room_name.widthWeight = 80
    menu = title.addButton("•••")
    menu.rightAligned()
    menu.widthWeight = 10
    menu.onTap = () => {
        handle_device(table, room)
    }
    table.addRow(title)

    devices = await get_device_list(room)
    for (d in devices) {
        let device = devices[d]
        device_row = new UITableRow()
        device_row.dismissOnSelect = false
        device_row.onSelect = () => {
            log("select " + device.name)
            on_select = select == on_show ? "" : select
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
            await show_device(table, room, device, realtime)
        }
    }
    table.reload()
    room_in_process = false
}

function handle_room(house) {
    let alert = new Alert()
    alert.title = "Handle room"
    alert.addAction("Add room")
    alert.addAction("Rename room")
    alert.addDestructiveAction("Remove room")
    alert.addCancelAction("Cancel")
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
    alert.title = "Add room"
    alert.addTextField("room name")
    alert.addAction("Add")
    alert.addCancelAction("Cancel")
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
    alert.title = "Rename room"
    for (r in rooms) {
        alert.addAction(rooms[r])
    }
    alert.addCancelAction("Cancel")
    alert.presentSheet().then(idx => {
        if(idx == -1)
            raspiot()
        else if(idx < rooms.length) {
            let oldroom = rooms[idx]
            let checkbox =  new Alert()
            checkbox.title = "Rename " + oldroom + " to"
            checkbox.addTextField("Input the room name")
            checkbox.addDestructiveAction("Rename")
            checkbox.addCancelAction("Cancel")
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
    let alert = new Alert()
    alert.title = "Remove room"
    let rooms = get_room_list(house)
    for (r in rooms) {
        alert.addAction(rooms[r])
    }
    alert.addCancelAction("Cancel")
    alert.presentSheet().then(idx => {
        if(idx == -1)
            raspiot()
        else if(idx < rooms.length) {
            let room = rooms[idx]
            let checkbox =  new Alert()
            checkbox.title = "Remove room"
            checkbox.message = "Sure to remove the " + room + "?"
            checkbox.addDestructiveAction("Remove")
            checkbox.addCancelAction("Cancel")
            checkbox.presentAlert().then(idx => {
                if(idx == 0) {
                    console.log(room + " is removed.")
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

async function get_device_attrs(device_uuid, realtime) {
    url = raspiot_endpoint + "/device/" + device_uuid + "?realtime=" + realtime
    let req = new Request(url)
    req.timeoutInterval = 5
    try {
        return await req.loadJSON()
    } catch (error) {
        notification("Get device attrs failed", "pls check network and raspiot-server.")
    }
}

async function show_device(table, room, device, realtime) {
    log("show " + device.name)
    device = await get_device_attrs(device.uuid, realtime)
    for (d in device.attrs) {
        row = new UITableRow()
        row.dismissOnSelect = false
        row.backgroundColor = device.status == "online" ? Color.green() : Color.orange()
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
            switch_icon = row.addImageAtURL(icon_uri(attr.value))
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

    if (!device.attrs.length) {
        notification("Unable to show attrs", "device " + device.name + " never connected, unable to get device attrs. Pls check the device.")
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
        notification("Fail to handle device",
                             device.name + " is offline.")
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

function icon_uri(value) {
    on_uri = raspiot_endpoint + "/statics/switch_on.png"
    off_uri = raspiot_endpoint + "/statics/switch_off.png"
    loading_uri = raspiot_endpoint + "/statics/loading.png"
    if (value == true) {
        return on_uri
    } else if (value == false) {
        return off_uri
    } else if (value == "loading") {
        return loading_uri
    }
}

function handle_device(table, room) {
    let alert = new Alert()
    alert.title = "Handle device"
    alert.addAction("Add device")
    alert.addAction("Rename device")
    alert.addDestructiveAction("Remove device")
    alert.addCancelAction("Cancel")
    alert.presentSheet().then(idx => {
        if(idx == 0)
            add_device(table, room)
        else if(idx == 1)
            rename_device(table, room)
        else if(idx == 2)
            del_device(table, room)
    })
}

async function add_device(table, room) {
    device = await scan_device_info()
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
    alert.addAction("Cancel")
    alert.addAction("Add")
    alert.present().then(async idx => {
        if(idx == 1) {
            device.name = alert.textFieldValue(0)
            device.mac_addr = alert.textFieldValue(1)
            device.protocol = alert.textFieldValue(2)
            device.port = alert.textFieldValue(3)
            device.ipv4_addr = alert.textFieldValue(4)
            device.ipv6_addr = alert.textFieldValue(5)
            device.sync_mode = alert.textFieldValue(6)
            device.sync_interval = alert.textFieldValue(7)
            await add_device_req(room, device)
            log(room + " add device: " + device.name)
            in_room(table, room)
        }
    })
}

async function scan_device_info() {
    scan = new CallbackURL("shortcuts://x-callback-url/run-shortcut")
    scan.addParameter("name", "qrcode-scan")
    try {
        scan_result = await scan.open()
        return JSON.parse(scan_result.result)
    } catch (error) {
        log("scan failed: " + error)
        return {}
    }
}

async function add_device_req(room, device) {
    url = raspiot_endpoint + "/device"
    let req = new Request(url)
    req.method="POST"
    req.timeoutInterval = 10
    req.headers = {"Content-Type": "application/json"}
    req.allowInsecureRequest = true
    req.addParameterToMultipart("name", device.name)
    req.addParameterToMultipart("mac_addr", device.mac_addr)
    req.addParameterToMultipart("protocol", device.protocol)
    req.addParameterToMultipart("port", device.port)
    req.addParameterToMultipart("ipv4_addr", device.ipv4_addr || "")
    req.addParameterToMultipart("ipv6_addr", device.ipv6_addr || "")
    req.addParameterToMultipart("sync_mode", device.sync_mode || "")
    req.addParameterToMultipart("sync_interval", device.sync_interval || "")
    req.addParameterToMultipart("room", room)
    log(req)
    response = await req.loadJSON()
    if ((response.code || 200) != 200) {
        notification("Add device " + device.name + " failed", response.message)
    }
}

async function del_device(room_table, room) {
    let alert = new Alert()
    alert.title = "Remove device"
    alert.message = "Tap the device and it will be remove."
    
    devices = await get_device_list(room)
    for (d in devices) {
        alert.addDestructiveAction(devices[d].name)
    }
    alert.addCancelAction("Cancel")
    alert.present().then(idx => {
        if(idx >= 0 && idx < devices.length) {
            del_device_confirm(room_table, room, devices[idx])
        }
    })
}

async function del_device_confirm(room_table, room, device) {
    let checkbox =  new Alert()
    checkbox.title = "Remove device"
    checkbox.message = "Confirm to remove the " + device.name + "?"
//     checkbox.addTextField("Input the device name for confirm.")
    checkbox.addDestructiveAction("Remove")
    checkbox.addCancelAction("Cancel")
    checkbox.presentAlert().then(async idx => {
        if(idx == 0) {
//             if(checkbox.textFieldValue(0) == device.name) {
                await del_device_req(device)
                console.log(device.name + " is removed.")
                in_room(room_table, room)
/*            } else { 
                console.log("Input no match, remove cancel.")
            }*/
        }
    })
}

async function del_device_req(device) {
    url = raspiot_endpoint + "/device/" + device.uuid
    let req = new Request(url)
    req.method="DELETE"
    req.timeoutInterval = 5
    req.headers = {"Content-Type": "application/json"}
    req.allowInsecureRequest = true
    log(req)
    await req.load()
}

function title_color() {
    if (Device.isUsingDarkAppearance()) {
        return new Color("#111111")
    } else {
        return new Color("#ededed")
    }
}

function notification(title, body) {
    notify = new Notification()
    notify.title = title
    notify.body = body
    notify.identifier = "raspiot_notification"
    notify.schedule()
    Notification.removeDelivered([notify.identifier])
}
